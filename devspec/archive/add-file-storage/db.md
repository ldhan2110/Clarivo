# DB: add-file-storage

**Source**: **live Postgres** — `docker exec clarivo-postgres-1 psql -U postgres -d clarivo`. No DB MCP is connected; queried `information_schema.columns`, `pg_constraint`, `pg_indexes` directly.
**Dialect**: postgresql 17 · **Schema**: `public` (per `devspec/context/schema.md` + `backend/src/config/database.config.ts`)

## Live schema as it actually is

| table | owner | rows | note |
|---|---|---|---|
| `users` | postgres | 2 | the only domain table |
| `migrations` | clarivo | 1 | TypeORM bookkeeping — `CreateUsers1790762306910` is the only applied migration |

> `devspec/context/schema.md` is **stale**: it claims zero domain tables. `users` exists and is populated. Refresh that file when this change's migration lands — it is the second migration this repo has ever run.

> The two tables have **different owners** (`users` → `postgres`, `migrations` → `clarivo`), confirming the gotcha in `rules.md` that the volume predates the current compose file. `backend/.env` connects as `postgres`, which works. Nothing in this change depends on which role owns what.

## Tables touched

### users  (exists — **read-only in this change**, no column added or altered)

| col | type | null | default | note |
|-----|------|------|---------|------|
| id | uuid | no | — | PK `PK_a3ffb1c0c8416b9fc6f907b7433`. **No DB default** — generated in the app as uuidv7 (`base.entity.ts:9`) |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |
| email | varchar(255) | no | — | unique `UQ_97672ac88f789774dd47f7c8be3` |
| password_hash | varchar(255) | no | — | |
| name | varchar(255) | no | — | |

This change only adds an inbound FK reference to `users.id`. No DDL on `users`.

### files  (new)

| col | type | null | default | state | note |
|-----|------|------|---------|-------|------|
| id | uuid | no | — | **add** | PK. uuidv7 generated in the app via `BaseEntity.@BeforeInsert` — Postgres 17 has no `uuidv7()`. No DB default, matching `users` |
| created_at | timestamptz | no | `now()` | **add** | `@CreateDateColumn`, from `BaseEntity` |
| updated_at | timestamptz | no | `now()` | **add** | `@UpdateDateColumn`, from `BaseEntity` |
| storage_key | varchar(255) | no | — | **add** | **UNIQUE.** Relative key `yyyy/mm/<uuidv7><ext>` (~49 chars worst case). Base dir comes from env `FILE_STORAGE_PATH` at read time — **an absolute path must never be stored here**, or moving the mount becomes a migration |
| original_name | varchar(255) | no | — | **add** | The name the client uploaded. Display only; never used to build a filesystem path (path-traversal) |
| mime_type | varchar(127) | no | — | **add** | Longest value in the allowlist is the docx type at 71 chars |
| size_bytes | **integer** | no | — | **add** | Deliberately `integer`, **not `bigint`** — TypeORM returns `bigint` as a JS string, which would silently poison the DTO. int max 2 147 483 647 ≈ 2 GB, 21× the 100 MB cap |
| uploaded_by | uuid | no | — | **add** | FK → `users.id`, **ON DELETE RESTRICT** |

Column naming is snake_case set explicitly with `name:` on each decorator — there is no global naming strategy configured (`database.config.ts`), so `storageKey` → `name: 'storage_key'` must be written by hand or the column ships as `storageKey`.

**No `deleted_at`** — the repo has no soft delete anywhere, and this change does not introduce the concept.

**No owner column.** There is deliberately no `owner_id` / `owner_type` / `project_id`. The first consuming domain table adds its own `file_id uuid REFERENCES files(id)`. The cost is recorded honestly: until a consumer exists, `files` cannot distinguish a live row from garbage.

## Indexes

| index | verdict |
|---|---|
| PK on `id` | automatic |
| UNIQUE on `storage_key` | **yes** — it is the lookup key for every download and the guard against a key collision. TypeORM emits `UQ_<hash>` from `unique: true` |
| `uploaded_by` | **skip for now.** Postgres does **not** auto-index an FK column. Two things would want it: a future "files I uploaded" query (no such screen exists), and the RESTRICT check on user deletion — which currently seq-scans `files`. With 2 users and no user-delete endpoint in the codebase, that scan costs nothing. Add `@Index()` on the column the moment either a per-uploader listing or user deletion ships. Worth a `ponytail:` comment naming exactly that ceiling |

## Impact

- **No existing reader or writer is affected.** `files` is new, and no column on `users` changes. `UsersService` (`backend/src/users/users.service.ts`) and `AuthService` (`backend/src/auth/auth.service.ts`) are the only code touching `users`; both are untouched by additive DDL on a separate table.
- **ON DELETE RESTRICT is the safe default here** and is already settled: a file row must not outlive a dangling uploader, and cascading would silently delete upload records (and orphan their bytes on disk, which no FK can clean up). There is no user-delete path in the codebase today, so nothing is blocked by the restriction.
- **FK direction matters for the future consumer**: `files` points *at* `users`, and consumers point *at* `files`. `files` itself never points at a domain table. That keeps `files` a leaf that any domain can reference without a circular dependency.
- **Migration verdict: purely additive.** One new table, one new FK, zero backfill, zero data reshape, zero destructive operation. Reversible — `down()` drops only the new table.

## Migration mechanics

- Generated, not hand-written: `cd backend && pnpm migration:generate src/database/migrations/CreateFiles`, then **read the emitted SQL before running it**.
- `pnpm migration:*` **builds first and runs against `dist/`** (`rules.md`) — a TypeScript error surfaces as a confusing migration failure. Compile clean before generating.
- The entity file must end in `.entity.ts` or the CLI glob `src/**/*.entity{.ts,.js}` will not see it and the generated migration will be empty.
- `synchronize: false` in **every** environment (`database.config.ts:25`). The schema only ever changes through a migration.
- `app.module.ts` passes `entities: []` + `autoLoadEntities: true` and `migrations: []` on purpose (vitest chokes on the raw-`.ts` glob). So the new entity reaches the running app **only** via `TypeOrmModule.forFeature([File])` in its own module — registering it anywhere else is a silent no-op.

## Suggested verify hooks (for capture's `tasks.md`)

- **Schema assertion** — after `migration:run`, query `information_schema.columns` for `files` and assert all 8 columns with the exact type/nullability above, plus the unique constraint on `storage_key` and the FK on `uploaded_by` with `RESTRICT` via `pg_constraint`.
- **`size_bytes` is a number, not a string** — insert a row, read it back through the repository, assert `typeof size_bytes === 'number'`. This is the one assertion that catches a `bigint` regression, and it fails silently otherwise.
- **Migration reverts clean** — `pnpm migration:revert` drops `files` and leaves `users` untouched; `pnpm migration:run` reapplies. Run against the local dev DB, never prod.
- **No regression on `users`** — `pnpm test` (the existing `users.service.spec.ts` / `auth.service.spec.ts`) still passes.

## Open questions

- None on the schema itself — the shape was settled in explore. The one open question in this change is HTTP-layer, not DB (`Content-Disposition: inline` for images vs uniform `attachment`); it is recorded in `design.md`.
