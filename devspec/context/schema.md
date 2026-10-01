# Schema conventions

**Source**: live Postgres (`docker exec clarivo-postgres-1 psql -U postgres -d clarivo`) + repo code. No DB MCP is connected.
**Dialect**: postgresql 17 · **Schema**: `public` · **Domain tables**: **4** (`users`, `files`, `projects`, `project_members`)

> Last refreshed 2026-10-01, after `add-projects` landed the third migration this project
> has ever run. Three migrations are applied: `CreateUsers1790762306910`,
> `CreateFiles1790827127817` and `CreateProjects1790842205065`.

## Tables

### `users` — accounts that can sign in
`backend/src/users/user.entity.ts` · migration `1790762306910-CreateUsers.ts`

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7 generated in the app |
| created_at / updated_at | timestamptz | no | default `now()` |
| email | varchar(255) | no | UNIQUE. Stored lowercased — `UsersService` normalises on every read and write, so the unique index doubles as case-insensitive matching without `citext` |
| password_hash | varchar(255) | no | argon2id. No `@Expose()` anywhere, so it cannot be serialised |
| name | varchar(255) | no | |

### `files` — one row per stored file
`backend/src/files/file.entity.ts` · migration `1790827127817-CreateFiles.ts`

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7 generated in the app |
| created_at / updated_at | timestamptz | no | default `now()` |
| storage_key | varchar(255) | no | UNIQUE. Path **relative** to the `FILE_STORAGE_PATH` env var, as `yyyy/mm/<id><ext>`. Never absolute — that is what keeps moving the storage directory a config change instead of a data migration |
| original_name | varchar(255) | no | The filename multer reports, which is already reduced to a basename. Display only — never used to build a path |
| mime_type | varchar(127) | no | From the allowlist in `files.constants.ts` |
| size_bytes | **integer** | no | Deliberately `integer`, not `bigint`: TypeORM returns `bigint` as a JS **string** |
| uploaded_by | uuid | no | FK → `users(id)` **ON DELETE RESTRICT**. No index yet — see the `ponytail:` note on the entity |

`files` has no owner column by design. A consuming domain table adds its own
`file_id uuid REFERENCES files(id)`, so `files` stays a leaf any domain can point at.

### `projects` — the domain spine everything else hangs off
`backend/src/projects/project.entity.ts` · migration `1790842205065-CreateProjects.ts`

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7 generated in the app |
| created_at / updated_at | timestamptz | no | default `now()` |
| code | varchar(64) | no | UNIQUE **globally**. Human handle (`CLT-DevSpec`). 64, not the repo's usual 255 |
| name | varchar(255) | no | |
| customer_bu | varchar(255) | no | customer / business unit |
| domain | varchar(255) | no | free text, deliberately **no CHECK** — customer data that grows, so a constraint would make every new vertical a migration |
| objective | text | **yes** | long prose |
| status | varchar(16) | no | default `'active'`, CHECK `status IN ('active','archived')` |
| starts_on / ends_on | date | **yes** | first `date` columns in this repo |
| created_by | uuid | no | FK → `users(id)` **ON DELETE RESTRICT**. No index — no per-creator listing and no user-delete path exists |

### `project_members` — one row per person per project
`backend/src/projects/project-member.entity.ts` · same migration

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7 generated in the app |
| created_at / updated_at | timestamptz | no | default `now()`. Ordering by this is what puts the owner first in the avatar stack — the owner row is written first |
| project_id | uuid | no | FK → `projects(id)` **ON DELETE CASCADE** — the one documented exception to the RESTRICT default |
| user_id | uuid | no | FK → `users(id)` **ON DELETE RESTRICT**. `@Index()`, deliberately: every project list query starts from "which projects is this user in" |
| role | varchar(16) | no | CHECK `role IN ('owner','member')` |

UNIQUE `(project_id, user_id)` — the first composite unique in this repo. It is what makes
"add somebody who is already a member" a 409 instead of a duplicate row.

This row **is the access grant**: `ProjectsService` starts its list query FROM this table and
joins outward to `projects`, so a project the viewer has no row for can never enter the
candidate set. Keep that join direction — it is the security property.

## Conventions these two tables establish

Everything added after this copies the table below. The `users` / `files` rows came first;
the `projects` / `project_members` rows settle four questions that were open until now.

| Area | Convention | Evidence |
|------|-----------|----------|
| **PK** | `id uuid`, **uuid v7 generated in the app** via `@BeforeInsert`, not by the DB. Postgres 17 has no `uuidv7()`. Time-sortable, so no sequence is needed | `base.entity.ts:9` |
| **Timestamps** | `created_at` / `updated_at`, both `timestamptz`, via `@CreateDateColumn` / `@UpdateDateColumn` on every table | `base.entity.ts:12` |
| **Table names** | lowercase plural, set explicitly: `@Entity('users')`, `@Entity('files')` | `user.entity.ts`, `file.entity.ts` |
| **Column naming** | snake_case, set explicitly with `name:` on each decorator. **There is no naming strategy configured** — a forgotten `name:` ships the column as camelCase. `file.entity.spec.ts` asserts this per column | `database.config.ts`, `file.entity.spec.ts` |
| **FK columns** | snake_case, named for the relationship rather than the table: `uploaded_by`, not `user_id`. Declared as a plain `@Column` **plus** a `@ManyToOne` + `@JoinColumn({ name: … })` on the same column, so the id is readable without loading the relation | `file.entity.ts` |
| **On delete** | **RESTRICT is still the default.** CASCADE would silently erase records and, where files are involved, orphan bytes on disk that no FK can clean up. **One exception exists**: `project_members.project_id` is CASCADE, because a membership row has no meaning without its project and owns no external bytes — cascading there cannot orphan anything a FK can't reach, which is exactly why `files.uploaded_by` stays RESTRICT. Read that as one reasoned exception, **not** as permission to cascade by default | `file.entity.ts`, `project-member.entity.ts` |
| **FK indexes** | Not created automatically — Postgres does not index an FK column. Add `@Index()` deliberately when a lookup or a delete path needs it; `files.uploaded_by` has none yet and says why in a `ponytail:` comment | `file.entity.ts` |
| **Integers** | `int` unless a value genuinely exceeds ~2.1 billion. **Avoid `bigint`**: TypeORM returns it as a JS string, which leaks into DTOs as a quoted number | `file.entity.ts` |
| **Soft delete** | **None.** No `deleted_at` on any table, and no `@DeleteDateColumn` anywhere. Deletes are hard | — |
| **Enums** | **`varchar` + `@Check()`**, not a Postgres enum type and not a lookup table. Adding a value to a pg enum needs `ALTER TYPE … ADD VALUE`, which cannot run inside a transaction block; a lookup table adds a join for a two-value set. A CHECK widens with a plain constraint swap. Set by `projects.status` and `project_members.role` | `project.entity.ts`, `project-member.entity.ts` |
| **Secrets in responses** | A column with no `@Expose()` on its DTO cannot be serialised. `users.password_hash`, `files.storage_key` and `files.uploaded_by` all rely on this | `user.dto.ts`, `file.dto.ts` |
| **Schema changes** | Migrations only. `synchronize: false` in **every** environment | `database.config.ts:25` |
| **Entity discovery** | CLI glob `src/**/*.entity{.ts,.js}` — a file must end in `.entity.ts` or the CLI will not see it. The **running app** uses `entities: []` + `autoLoadEntities: true` instead (the raw-`.ts` glob breaks under vitest), so `TypeOrmModule.forFeature([X])` in the owning module is the only thing that registers an entity at runtime | `database.config.ts:21`, `app.module.ts` |
| **Migration discovery** | `src/database/migrations/*{.ts,.js}`, tracked in table `migrations`. `pnpm migration:*` builds first and runs against `dist/`, so a TypeScript error surfaces as a confusing migration failure | `database.config.ts:22` |
| **Logging** | dev logs `error`, `warn`, `migration`; prod logs `error` only | `database.config.ts:26` |

## Settled by `add-projects`

| Was open | Now |
|---|---|
| enum representation | `varchar` + `@Check()` — see the convention row above |
| multi-column unique constraint | `UNIQUE (project_id, user_id)` on `project_members`, declared with `@Unique(['projectId','userId'])` |
| `date` columns | `projects.starts_on` / `ends_on`. TypeORM returns a `date` as a **`'YYYY-MM-DD'` string**, and that is what ships — typed `string` on the entity and the DTO. Wrapping it in a `Date` re-introduces a timezone and can render a start date a day early for a viewer behind UTC |
| `ON DELETE CASCADE` | Appears for the first time, once, with its reasoning recorded above. RESTRICT remains the default |

## Still not established
Money and JSON column types, and composite (multi-column) **indexes** — the composite
constraint above indexes `(project_id, user_id)` as a side effect, but no index has yet been
created for its own query plan. Decide on the first table that needs one and refresh this file.
