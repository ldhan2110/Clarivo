# DB: add-projects

**Source**: **live** — `docker exec clarivo-postgres-1 psql -U clarivo -d clarivo` (no DB MCP is connected).
**Dialect**: postgresql 17 · schema `public` · read 2026-10-01.
**Conventions**: `devspec/context/schema.md` (the canonical table below) + `backend/src/database/base.entity.ts`.

Existing domain tables: `users` (2 rows), `files` (0 rows). Two migrations applied:
`CreateUsers1790762306910`, `CreateFiles1790827127817`. This change is the third.

## Tables touched

### `users` (exists — read only, **not altered**)
| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | — | PK. Referenced by both new tables |
| email | varchar(255) | no | — | `UQ_97672ac88f789774dd47f7c8be3` |
| password_hash | varchar(255) | no | — | never serialised |
| name | varchar(255) | no | — | |
| created_at / updated_at | timestamptz | no | now() | |

No column is added, altered or dropped on `users`. The change only points two new FKs at `users.id`.

### `projects` (**new**)
| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | — | **add** · PK, uuidv7 from `BaseEntity` |
| created_at / updated_at | timestamptz | no | now() | **add** · `BaseEntity` |
| code | varchar(64) | no | — | **add** · UNIQUE, **globally**. Human handle (`CLT-DevSpec`) |
| name | varchar(255) | no | — | **add** |
| customer_bu | varchar(255) | no | — | **add** · customer / business unit (`CLT`) |
| domain | varchar(255) | no | — | **add** · free text, **no CHECK** — see Decisions |
| objective | text | **yes** | — | **add** · long prose, not shown in the create modal as required |
| status | varchar(16) | no | `'active'` | **add** · CHECK `status IN ('active','archived')` |
| starts_on | date | **yes** | — | **add** · first `date` column in this repo |
| ends_on | date | **yes** | — | **add** |
| created_by | uuid | no | — | **add** · FK → `users(id)` **ON DELETE RESTRICT** |

Indexes to create deliberately (Postgres does not index an FK column):
- `UQ projects(code)` — from `unique: true` on the column.
- `IDX projects(status)` — **skipped**. The list query always filters by membership first; status narrows a handful of rows. Record the skip, add it when a project count justifies it.
- `IDX projects(created_by)` — **skipped**. No per-creator listing and no user-delete path exists (`UsersService` has no remove method), so the RESTRICT check never runs.

### `project_members` (**new**)
| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | — | **add** · PK, uuidv7 from `BaseEntity` |
| created_at / updated_at | timestamptz | no | now() | **add** · `BaseEntity` |
| project_id | uuid | no | — | **add** · FK → `projects(id)` **ON DELETE CASCADE** — the one documented exception to the repo's RESTRICT default |
| user_id | uuid | no | — | **add** · FK → `users(id)` **ON DELETE RESTRICT** |
| role | varchar(16) | no | — | **add** · CHECK `role IN ('owner','member')` |

Constraints and indexes:
- `UQ project_members(project_id, user_id)` — **first composite unique constraint in this repo**. One row per person per project; makes "add an existing member" a 409 rather than a duplicate.
- `IDX project_members(user_id)` — **required, not optional**. Every project list query starts from "which projects is this user in", so `user_id` is the hot lookup. The composite unique only indexes `project_id` as its leading column, so it does not serve this.

## Impact

- `backend/src/users/user.entity.ts` — unchanged. Two new tables reference `users.id`; nothing on `User` needs an inverse relation (none of the existing entities declare one either — `FileEntity.uploader` is one-directional).
- `backend/src/users/users.service.ts` — unchanged, and **no user-delete path exists**, so adding two more RESTRICT references to `users` costs nothing today. When a user-delete ever ships it must now also account for `projects.created_by` and `project_members.user_id`.
- `backend/src/files/*` — untouched. `files` stays unconsumed in this change (the Context tab is a placeholder); the first `file_id` FK lands in `add-project-context`.
- `backend/src/app.module.ts` — gains one import registering `ProjectsModule`. Entity registration happens **only** via `TypeOrmModule.forFeature([...])` inside that module (`app.module.ts` passes `entities: []` + `autoLoadEntities: true`); registering anywhere else is a silent no-op.
- `backend/src/common/dtos/pagination.dto.ts` + `sort.dto.ts` — reused as-is by the list query DTO, not modified. `SortDto.sortBy` is whitelisted per domain by overriding with `@IsIn`.
- **No existing query reads either new table.** Nothing can regress.

## Migration verdict

**Purely additive.** Two new tables, three new FKs, two new unique constraints, one new index, two CHECK constraints. No column on an existing table is added, altered or dropped. **No backfill, no data reshape, no destructive operation anywhere.** Reverts clean by dropping the two new tables in FK order (`project_members` then `projects`).

One migration file covering both tables — TypeORM's generator emits a single file per `migration:generate` run, and the two tables are one logical unit. Expected name `<timestamp>-CreateProjects.ts` in `backend/src/database/migrations/`.

⚠ `pnpm migration:*` **builds first and runs against `dist/`** — a TypeScript error surfaces as a confusing migration failure. Compile clean before generating.

## Decisions settled here

| Question | Decision | Why |
|---|---|---|
| Enum representation — pg enum type vs lookup table vs varchar+CHECK | **varchar + CHECK**, via TypeORM's `@Check()` entity decorator | `schema.md` lists this as undecided; `status` forces the call. A pg enum type needs its own `ALTER TYPE ... ADD VALUE` migration (which cannot run inside a transaction block) to add a value; a lookup table adds a join for a 2-value set. varchar + CHECK widens with a plain constraint swap. **This sets the precedent for every enum after it — record it in `schema.md`.** |
| `domain` — CHECK too? | **No. Plain varchar, no constraint** | `status` is a closed 2-value set the code branches on. `domain` is customer data that grows (`Logistics`, `Finance`, …); a CHECK there turns every new customer vertical into a migration. |
| `project_members.project_id` ON DELETE | **CASCADE** — the one exception to the repo's RESTRICT default | A membership row has no meaning without its project and owns no external bytes, so cascading cannot orphan anything a FK can't reach (which is exactly why `files.uploaded_by` is RESTRICT). Without it, archiving-then-deleting a project would be blocked by its own membership rows. |
| `project_members.user_id` ON DELETE | **RESTRICT** — matches `files.uploaded_by` | Keeps the repo's default. A user who is still on a project cannot vanish silently. |
| Archive = `deleted_at`? | **No.** `status='archived'` | The repo has **no soft delete anywhere** and no `@DeleteDateColumn`. A `deleted_at` would introduce a second deletion concept; a status value is domain state the UI already shows (screen 5 renders an `Active` badge). |
| `code` scope | **Globally UNIQUE** | One index, one error message, no coupling to `customer_bu`. A composite `(customer_bu, code)` would also make renaming a customer a uniqueness event. |
| `size` of `code` | varchar(64) | `CLT-DevSpec` shape. Everything else stays at the repo's 255. |

## Open questions

None blocking. Two notes for whoever refreshes `devspec/context/schema.md` (that refresh is a task in this change, not a separate job):

- This change settles three of the four items `schema.md` lists under **"Still not established"**: enum representation (varchar + CHECK), composite unique constraints (`project_members`), and the first `date` columns. Money and JSON column types remain unestablished.
- `ON DELETE CASCADE` appears for the first time. The convention line in `schema.md` currently reads "RESTRICT is the default" — it should stay the default, with the CASCADE exception and its reasoning recorded beside it, so the next change does not read one CASCADE as permission to cascade everything.

## Suggested Verify hooks for tasks.md

- **Schema assertion** — a vitest spec reading `getMetadataArgsStorage()` (the pattern `backend/src/files/file.entity.spec.ts` already uses; `DataSource.getMetadata()` throws before connection) asserting every column's snake_case `name:`, both CHECK constraints, and the composite unique.
- **Migration round-trip** — `pnpm migration:run` → `pnpm migration:revert` → `pnpm migration:run` against the dev DB, then `\d projects` / `\d project_members` confirming types, FKs, `ON DELETE` actions and indexes.
- **No-regression** — `pnpm test` (the existing suite) still green; `users` and `files` are structurally untouched, so any failure there is a real regression.
