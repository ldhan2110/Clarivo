# Design: backend-foundation

Grounded in `devspec/context/` — `conventions.md` (backend block), `rules.md` (ESM non-negotiables), `patterns.md` ("not yet established" list) — and in `db.md`, a live read of the running server. No `devspec/improve/` exists yet, so there are no recorded human decisions to reconcile against.

`context/schema.md` is absent because init found no DDL, compose file, or ORM models in the repo. That was true of the repo and wrong about the environment: a Postgres 17.11 server was already running with 13 tables from a deleted earlier scaffold. Those were backed up and dropped on explicit instruction (see `db.md`), so this change now migrates into an empty schema. Correcting `context/schema.md` is a follow-up, not part of this change.

Every item below establishes a pattern rather than following one — `patterns.md` records that configuration, validation, error handling, and data access have no implementation to mirror. The choices here become the house style, so they are stated explicitly.

## Architecture

Request path:

```
HTTP request
  → ValidationPipe (global, src/main.ts)
      ↘ 400 — unknown property, or wrong type
  → Controller
  → Service
  → Repository (TypeORM)
  → DataSource ──→ Postgres 18
                        │
  AllExceptionsFilter (global, src/main.ts)
      ← throw from any layer above
      ↘ one error envelope: { statusCode, code, message, details?, path, timestamp }
```

Startup path:

```
src/main.ts
  → AppModule
      → ConfigModule.forRoot({ validate })         ─┬→ invalid env: log offenders, exit(1)
                                                    └→ valid: ConfigService populated
      → TypeOrmModule.forRootAsync({ useFactory })   → reads ConfigService (never process.env)
                                                     → DataSource (synchronize: false)
  → app.useGlobalPipes(ValidationPipe)
  → app.useGlobalFilters(AllExceptionsFilter)
  → listen(PORT)
```

Migration path (no ESM loader involved):

```
nest build                                    → dist/ (dist/database/data-source.js)
node node_modules/typeorm/cli.js \
  -d dist/database/data-source.js \
  migration:generate src/database/migrations/<Name>   → a .ts file in SOURCE
                                                        (TS is the CLI default; -o would force JS)
nest build && node .../cli.js -d dist/... migration:run → applies dist/database/migrations/*.js
```

Two DataSource definitions exist for one database, and they must not drift:

- `src/database/data-source.ts` — a standalone `DataSource`, the CLI's only entry point. Knows about migrations.
- `src/config/database.config.ts` — a factory returning `TypeOrmModuleOptions` for Nest's DI container. Knows about the request-time connection.

Both build their options from one shared object so a setting changed in one place applies to both. The runtime module does not run migrations.

## Chosen approach, and what was rejected

### Migration CLI: build first, plain `node`

`rules.md` records that `__dirname` and `require()` do not exist in this package, and that every relative import needs an explicit `.js` extension. That makes the usual TypeORM CLI setups hostile:

- **Rejected — `typeorm-ts-node-esm`** (TypeORM's own documented ESM path). Pulls in `ts-node`, whose ESM support rides the deprecated `--loader` hook. Highest breakage risk on Node 26.
- **Rejected — `tsx`.** Works today and needs no build step, but adds a dependency solely to avoid a two-second compile.
- **Rejected — Node's native type stripping** (`--experimental-strip-types`). It does not emit `emitDecoratorMetadata`, so entity decorators lose their type metadata and TypeORM cannot read column types. This is not a tuning problem; it is a hard incompatibility.
- **Chosen — compile, then run the CLI on the compiled DataSource.** Zero new dependencies, no loader flags, nothing to break when Node changes its hook API. Verified: `migration:generate` emits TypeScript by default (`-o/--outputJs` is the opt-in for JS), so migrations still land as `.ts` under `src/`, reviewable in the diff. Cost is one `nest build` before generating or running a migration, folded into the npm script.

### Entity registration: explicit imports, not globs

`rules.md`: no `__dirname`, which rules out the conventional `entities: [__dirname + '/**/*.entity.js']`. `import.meta.dirname` would technically work, but a glob over compiled output silently resolves to nothing when the build layout shifts — and this package already has two `tsconfig` targets that emit to different depths (`dist/main.js` vs `dist/src/main.js`, per `rules.md`). A missing entity glob fails as "table does not exist" at query time rather than at boot.

**Chosen:** an explicit `entities` array in a single barrel the DataSource and the Nest factory both import. Adding an entity means adding a line — a visible, reviewable step, and an import error if the path is wrong. Migrations keep a glob, because they are generated files whose set changes constantly and whose absence is caught by the `migrations` table check.

### Naming strategy: hand-written, no dependency

Database columns are `snake_case`, entity properties camelCase. The common route is the `typeorm-naming-strategies` package. Extending TypeORM's `DefaultNamingStrategy` to snake-case column, table, and join-column names is roughly 25 lines with no new dependency, and `rules.md` favours not adding one for what a few lines cover.

**Chosen:** a local `SnakeNamingStrategy`. **Fallback:** if it misbehaves on a relation naming case, swap in the package rather than growing the local class.

### uuid v7 from the application, because the server cannot

**Amended.** The original design generated keys in the database via `@PrimaryColumn('uuid', { default: () => 'uuidv7()' })`. A live capability scan (`db.md`) proved that impossible here:

```
uuidv7()          absent  — ERROR: function uuidv7() does not exist
gen_random_uuid() present — v4 only
uuid_generate_v4  absent  — uuid-ossp available but offers no v7 either
```

`uuidv7()` is a PostgreSQL **18** function. The server is **17.11**, and its data volume is `PG_VERSION 17` — a 16 or 18 image will not start on that volume, so moving off 17 means recreating it and destroying its contents. Staying on 17 was chosen.

**Chosen:** generate v7 in the application — `v7()` from the `uuid` package, called in an `@BeforeInsert()` hook on `AbstractEntity`. The column has **no** database default.

- **Rejected — `gen_random_uuid()` as the default.** It works and keeps generation in the database, but produces v4. Random v4 keys scatter B-tree inserts across the index; time-ordered v7 keys append. Index locality was the entire reason v7 was chosen, so falling back to v4 discards the benefit while keeping the ceremony.
- **Rejected — hand-rolling v7 (~15 lines, no dependency).** Normally the preferred trade here. Rejected because v7 requires a monotonic counter for ids minted inside the same millisecond; get that wrong and ids from a burst of inserts are unordered *among themselves*. The failure is silent — every id still looks like a valid v7 — and it destroys precisely the ordering property being paid for. The `uuid` package handles it.
- **Rejected — a mixed default** (`gen_random_uuid()` in the database, v7 from the app). Two uuid versions in one column, with the version depending on the insert path. Unreadable.

**The consequence must be stated plainly:** id generation has moved out of the database. An `INSERT` from raw SQL, a seed script, or inside a migration will now **fail on a null `id`** unless it supplies one itself. Under the PG18 plan the database covered that path; it no longer does. This is the real cost of staying on 17, and it is the reason the original design preferred a DB-side default.

If a deploy target ever runs 18, the hook becomes redundant and a DB-side `uuidv7()` default is preferable — a deliberate future change, not a config flip, since 17→18 has no in-place volume upgrade.

### Audit columns ship unused

`created_by` / `updated_by` are nullable `uuid` with **no foreign key** to a `users` table, and nothing in this change writes to them. Confirmed as intended.

- **No FK** because every table would then reference `users`, making `users` circular against its own base class and forcing a user row into every test fixture.
- **Unused** because populating them needs a request identity, which needs authentication — the deferred `auth` change. Putting the columns in now means that change adds a subscriber, not a migration against every existing table.

Open note, not a blocker: until `auth` lands, these two columns are always null. Anyone reading the schema should not mistake that for a bug.

### `sortBy` is deliberately not wired to the query

`PaginationQueryDto` carries `sortBy` as an opaque validated string. The base DTO provides **no** query-building helper that consumes it.

This is a security boundary, not an omission. A column name cannot be parameterized in SQL — it is interpolated. A shared helper that accepted `sortBy` and appended it to an `ORDER BY` would be an injection sink reachable from every list endpoint that adopted the base class, and the vulnerability would be invisible at each call site. Each endpoint must map `sortBy` through its own allowlist of permitted column names and reject anything else. `rules.md` gets this recorded as a standing constraint.

## Impact Area

### Decision Defaults

Pre-decided so the worker proceeds instead of stalling.

| Gray area | Default decision | Fallback if default doesn't fit |
|---|---|---|
| Where config code lives | `src/config/` — `env.validation.ts`, `database.config.ts` | mirror `src/modules/<feature>/` foldering per `conventions.md` |
| Where shared base classes live | `src/common/` — `entities/`, `dto/`, `filters/`, `database/naming.strategy.ts` | — |
| Where DB wiring lives | `src/database/` — `data-source.ts`, `entities.ts` barrel, `migrations/` | — |
| uuid v7 source | `v7()` from the `uuid` package, in an `@BeforeInsert()` hook. No DB default on `id` | on PostgreSQL 18+, drop the hook and use a `uuidv7()` column default |
| Raw inserts that skip the entity | Must supply `id` explicitly. Seed scripts and data migrations included | — |
| Env var naming | `SCREAMING_SNAKE`, database vars prefixed `DATABASE_` | — |
| Env: URL or discrete fields | Discrete (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`) — one way to configure, no precedence rules | add `DATABASE_URL` only if a deploy target supplies only a URL |
| Env validation failure behaviour | Log every offending variable with its constraint, then `process.exit(1)`. Never start degraded | — |
| `NODE_ENV` allowed values | `development` \| `test` \| `production`, default `development` | — |
| Default `PORT` | `3000`, matching the scaffold's `src/main.ts:6` | — |
| Pagination defaults | `page` 1, `limit` 20 | — |
| Pagination bounds | `page` ≥ 1; `limit` 1–100. Out of range → 400, not silent clamp | — |
| `order` values | `ASC` \| `DESC`, case-insensitive input, uppercased by transform, default `DESC` | — |
| Paginated response shape | `{ items: T[], meta: { page, limit, total, totalPages, hasNext, hasPrev } }` | — |
| `ValidationPipe` options | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `transformOptions: { enableImplicitConversion: false }` | — |
| Why not implicit conversion | Explicit `@Type(() => Number)` on each field. Implicit conversion coerces silently and turns a malformed value into a plausible wrong one | — |
| Error envelope fields | `{ statusCode, code, message, details?, path, timestamp }`; `code` a stable `SCREAMING_SNAKE` string | — |
| Postgres error code mapping | `23505` unique → 409 `CONFLICT`; `23503` FK → 409 `CONFLICT`; `23502` not-null → 400 `VALIDATION_ERROR`; `22P02` bad input syntax → 400 | unmapped `QueryFailedError` → 500 `INTERNAL_ERROR` |
| 500 response body | Generic `"Internal server error"`, `code: INTERNAL_ERROR`. Driver message and stack go to the logger only, never the response | — |
| Filter logging level | 5xx at `error` with the full cause; 4xx at `warn` without a stack | — |
| Migration file naming | TypeORM's default `<timestamp>-<Name>.ts` under `src/database/migrations/` | — |
| Migrations at container start | **No.** Not in `CMD`, not in an entrypoint. Run as a separate one-off command so concurrent replicas cannot race the same migration | — |
| Initial migration content | Whatever `migration:generate` produces from the entity set. No hand-written DDL | — |
| Soft delete default scope | `@DeleteDateColumn` — TypeORM excludes soft-deleted rows from `find` automatically; `withDeleted: true` opts in | — |
| Naming strategy | Hand-written `SnakeNamingStrategy` extending `DefaultNamingStrategy`, no new dependency | swap in `typeorm-naming-strategies` if a relation case misbehaves |
| Postgres host port | `5433:5432` — 5432 is taken by a native install per `rules.md` | — |
| Postgres image | `postgres:17-alpine` — **must** match the existing `clarivo_pgdata` volume (`PG_VERSION 17`); a different major refuses to start on it. Named volume, `pg_isready` healthcheck | `postgres:17` if an alpine-specific issue appears |
| Docker base image | `node:26-alpine` for build and runtime stages | `node:26-slim` if a native module needs glibc |
| pnpm in the image | Pin an explicit version via `corepack`. `backend/package.json` has **no** `packageManager` field (unlike `frontend/package.json:22`), so the image cannot infer one — the Dockerfile must state it | add `packageManager` to `backend/package.json` and let corepack read it |
| Runtime stage contents | `pnpm install --prod --frozen-lockfile` + `dist/`. No source, no devDependencies | — |
| Container user | Non-root — the `node` user already present in the official image | — |
| Migrations in the image | Yes, `dist/database/migrations/` is included so the one-off migrate command can run from the same image | — |
| Test database | The same Compose Postgres service. Integration specs assume it is up; they do not spin their own | dedicated `clarivo_test` database if suites start colliding |
| Layer tag for Docker work | `[infra]` — a deliberate addition to the documented tag set (`[backend] [service] [frontend] [db] [test]`), because tagging a Dockerfile `[backend]` would corrupt the reviewer's per-layer scan | — |

### Blast Radius

Resolved by reading the files directly: `rules.md` records the code graph is empty (0 nodes), so symbol lookup is unavailable.

```
NEW  backend/src/config/env.validation.ts                       — safe/reversible
NEW  backend/src/config/database.config.ts                      — safe/reversible
NEW  backend/src/database/data-source.ts                        — safe/reversible
NEW  backend/src/database/entities.ts                           — safe/reversible
NEW  backend/src/database/migrations/<ts>-InitialSchema.ts      — safe/reversible (additive, forward-only)
NEW  backend/src/common/database/naming.strategy.ts             — safe/reversible
NEW  backend/src/common/entities/abstract.entity.ts             — safe/reversible
NEW  backend/src/common/dto/pagination-query.dto.ts             — safe/reversible
NEW  backend/src/common/dto/base-response.dto.ts                — safe/reversible
NEW  backend/src/common/dto/paginated-response.dto.ts           — safe/reversible
NEW  backend/src/common/filters/all-exceptions.filter.ts        — safe/reversible
NEW  backend/.env.example                                       — safe/reversible (no secrets)
NEW  backend/Dockerfile                                         — safe/reversible
NEW  backend/.dockerignore                                      — safe/reversible
NEW  docker-compose.yml            (repo root)                  — safe/reversible
EDIT backend/src/app.module.ts     (+ ConfigModule, TypeOrmModule)  — safe/reversible
EDIT backend/src/main.ts           (+ global pipe, + global filter)  — safe/reversible
EDIT backend/package.json          (+ deps incl. uuid, + migration scripts) — safe/reversible
NEW  backend/src/config/env.validation.spec.ts                  — safe/reversible
NEW  backend/src/database/data-source.spec.ts                   — safe/reversible
NEW  backend/src/common/dto/pagination-query.dto.spec.ts        — safe/reversible
NEW  backend/test/error-envelope.e2e-spec.ts                    — safe/reversible
NEW  backend/test/abstract-entity.e2e-spec.ts                   — safe/reversible
```

Nothing is dropped, deleted, or narrowed. The two edits are additive: `app.module.ts` currently has `imports: []`, and `main.ts` registers nothing beyond `listen()`. `src/modules/authentication/` is left untouched — its two 0-byte files stay as they are, since filling them is the deferred `auth` change.

No external side effects: no network calls, no third-party service, no deploy. The only stateful action is creating a schema in a local container database.

### Risk and reversibility

Every entry is **safe/reversible**. The initial migration is additive and forward-only — it creates, it does not drop or alter existing data, and there is no existing data. No destructive DB operation appears anywhere in this change, per `rules.md`.

Two things in this change's history are *not* safe/reversible, and both sit outside the file list:

- **The 13 orphaned tables were dropped.** Done on explicit human instruction, after a verified `pg_dump` to `/Users/admin/clarivo-db-backup-20260930-150237.sql`. Reversible only via that file. Deliberately **not** encoded as a migration — it is environment cleanup, not schema history.
- **Postgres 17 is now effectively pinned** by its own data volume. Moving to 18 (and regaining native `uuidv7()`) requires destroying `clarivo_pgdata`, because major versions have no in-place upgrade.

## Open questions

- **`context/schema.md` is wrong by omission.** Init declared no database; one was running the whole time. Worth a `/devspec-init` refresh after this change so later changes ground on the real server version and the `uuidv7()` gap instead of rediscovering it.
- **Raw inserts no longer get a free id.** Direct consequence of app-side generation. Any future seed script or data migration must supply `id` itself, or fail on a null primary key.
- **`_probe` removal depends on a future change.** Its cleanup migration is destructive (drop table) and will need a human decision when the first real entity arrives. If that change never comes, a stray table lingers.
- **`created_by` / `updated_by` stay null until `auth`.** Intended, recorded here so a schema reader does not file it as a defect.
- **`[infra]` layer tag** is not in the documented tag set. Used deliberately for the two Docker sections; noted above with the reasoning.
