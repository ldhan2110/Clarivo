_approved_by: LE AN_
_approved_at: 2026-09-30_

# Proposal: backend-foundation

## Why

The backend is a stock NestJS scaffold: one `GET /` returning `"Hello World!"`, an empty root module, and two 0-byte files under `src/modules/authentication/`. Nothing can be built on it yet, because four things every feature needs are absent:

- **No configuration layer.** No `.env`, no loader, no validation. A missing or malformed variable surfaces as a runtime `undefined` deep inside a request, not as a startup failure.
- **No database.** No driver, no connection, no migration tool, no migration directory. Every feature that stores anything is blocked.
- **No input validation.** `src/main.ts` registers no global pipe, so request bodies reach handlers unchecked and unknown fields pass through untouched.
- **No error contract.** An unhandled throw returns Nest's default shape, and a database driver error would leak its raw message to the client.

Each of these gets decided once. Deciding them inside the first feature change instead buries infrastructure choices in unrelated work and guarantees the second feature re-litigates them.

## What it delivers

A backend that boots against a real Postgres database, refuses to start on bad configuration, rejects malformed input at the edge, and returns one predictable error shape.

Concretely:

1. **Validated environment configuration** — a typed env schema checked at startup. Process exits with a message naming the offending variables rather than starting in a broken state. Ships a values-free `.env.example`.
2. **TypeORM connected to Postgres 18** — wired through Nest's async config so connection settings come from validated config, never from `process.env` read at a call site. `synchronize` is off permanently.
3. **Migration workflow** — a standalone DataSource the TypeORM CLI drives, a migration directory, and scripts to generate and run migrations. One initial migration creating the base schema.
4. **`AbstractEntity`** — the base every entity extends: uuid v7 primary key, and the audit columns `created_at` / `created_by` / `updated_at` / `updated_by` plus `deleted_at` for soft delete.
5. **Base DTOs** — `PaginationQueryDto` (page / limit / sortBy / order) for list endpoints, `BaseResponseDto` for the identity and timestamp fields every response repeats, and a `PaginatedResponseDto<T>` wrapper.
6. **Global validation** — a `ValidationPipe` that transforms, whitelists, and rejects unknown properties on every request.
7. **Global exception filter** — one error envelope for every failure path, mapping Nest HTTP exceptions and TypeORM database errors to sensible status codes without leaking driver internals on a 500.

A local Postgres 18 service so the above is runnable, a reproducible container build of the backend itself, and tests proving the connection and the error contract.

## Scope

**In**

- `@nestjs/config` env schema + validation, `.env.example`
- TypeORM + `pg`, Nest module wiring, standalone CLI DataSource
- Migration directory, generate/run scripts, initial migration
- `AbstractEntity` with uuid v7 PK, audit columns, soft-delete column
- `PaginationQueryDto`, `BaseResponseDto`, `PaginatedResponseDto<T>`
- Global `ValidationPipe` and global exception filter, both registered in `src/main.ts`
- Local Postgres 18 service definition (Docker Compose)
- Backend container image (multi-stage `Dockerfile` + `.dockerignore`), running as a non-root user
- Tests: config rejects a bad env, the app connects, the filter returns the documented envelope

**Out**

- **Authentication and the `User` entity.** `created_by` / `updated_by` land as nullable uuid columns with no foreign key and no value written to them. Filling them needs a request identity, which needs login, which is its own change. See "Deferred" below.
- Any domain table. This change creates the base class and the migration mechanism, not business entities.
- A `users` foreign key on the audit columns. Every table would then reference `users`, which makes `users` itself circular and forces a user row into every test fixture.
- Response serialization interceptor, API versioning, rate limiting, logging/observability configuration, health checks, OpenAPI docs.
- Frontend changes. Nothing on this change is visible to a user.

**Deferred to a follow-up change (`auth`)**

`User` entity, register/login, JWT strategy and guard, and the mechanism that populates `created_by` / `updated_by` from the authenticated request user. That mechanism was discussed as `AsyncLocalStorage` middleware plus a TypeORM `EntitySubscriber`; it is unbuildable and untestable until a user identity exists, so it is not specced here. This change only guarantees the columns are in place for it to fill.

## Decisions already settled

Carried in from the exploration session, so the spec does not re-open them:

| Decision | Choice | Why |
|---|---|---|
| Database | PostgreSQL 18 | Native `uuidv7()`; not available before 18 |
| Primary key | uuid v7, generated by the database default | Time-sortable (better index locality than v4), and correct even for inserts that bypass TypeORM |
| Soft delete | `deleted_at` via `@DeleteDateColumn` | Audit trail retained |
| Validation library | `class-validator` + `class-transformer`, same library for env and DTOs | Nest-idiomatic, and matches the decorator style TypeORM entities already require |
| Base entity name | `AbstractEntity` | TypeORM already exports `BaseEntity` (its ActiveRecord class) — reusing the name collides |
| Migration CLI | Build first, then plain `node` against the compiled DataSource | No `ts-node`/`tsx` ESM loader dependency. `migration:generate` still emits TypeScript by default (`--outputJs` is opt-in), so migrations stay `.ts` in source |
| `synchronize` | `false`, permanently | Schema changes only ever ship as reviewed migration files |
| Column naming | `snake_case` in the database, camelCase entity properties | Via a naming strategy, so neither side is awkward |
| Postgres host port | 5433 | 5432 is occupied by a native Postgres install on the dev machine |

## Verified during exploration

Two risks were checked rather than assumed, because both would have changed the approach:

- **TypeScript 6.0.3 still emits `design:type` decorator metadata** under `experimentalDecorators` + `emitDecoratorMetadata`. Confirmed by compiling a decorated class and reading the output. Had it not, TypeORM and `class-validator` would both be unusable and the whole stack would need rethinking.
- **`migration:generate` defaults to TypeScript output**, with `-o/--outputJs` as the opt-in for JavaScript. Confirmed against TypeORM's documentation. This is what makes the build-first CLI approach viable without an ESM loader.
