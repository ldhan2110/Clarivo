# Schema conventions

**Source**: live Postgres (`docker exec clarivo-postgres-1 psql -U postgres -d clarivo`) + repo code. No DB MCP is connected.
**Dialect**: postgresql 17 · **Schema**: `public` · **Domain tables**: **7** (`users`, `files`, `projects`, `project_members`, `project_documents`, `knowledge_blocks`, `knowledge_refs`)

> Last refreshed 2026-10-01, after `add-project-context` landed the fourth migration this
> project has ever run. Four migrations are applied: `CreateUsers1790762306910`,
> `CreateFiles1790827127817`, `CreateProjects1790842205065` and
> `CreateProjectContext1790848237685`.

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

### `project_documents` — one uploaded context document
`backend/src/context/project-document.entity.ts` · migration `1790848237685-CreateProjectContext.ts`

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7 generated in the app |
| created_at / updated_at | timestamptz | no | default `now()` |
| project_id | uuid | no | FK → `projects(id)` **ON DELETE CASCADE** · `@Index()` — every query starts "documents of this project" |
| file_id | uuid | no | FK → `files(id)` **ON DELETE RESTRICT**, **UNIQUE**. The first FK ever to point at `files`, exactly as that table was designed for |
| title | varchar(255) | no | Seeded from `files.original_name`, renameable |
| status | varchar(16) | no | default `'pending'`. CHECK `IN ('pending','parsing','summarizing','proposing','ready','failed','archived')` — the pipeline walks it, and `archived` is how a document is set aside (there is no delete) |
| error | text | yes | Failure reason, shown in the UI |
| char_count | integer | yes | Extracted text length. `integer`, not `bigint` |
| digest | text | yes | The map-reduce summary. **The only thing persisted from the text** — the bytes are on disk and re-parsing is free, so only the part that costs money is stored |
| uploaded_by | uuid | no | FK → `users(id)` **ON DELETE RESTRICT** |

### `knowledge_blocks` — the page, the proposal queue and the history, in one table
`backend/src/context/knowledge-block.entity.ts` · same migration

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7. **The stable id is what the design rests on** — it lets a model patch one block instead of rewriting the page |
| created_at / updated_at | timestamptz | no | default `now()` |
| project_id | uuid | no | FK → `projects(id)` **ON DELETE CASCADE** |
| section | varchar(16) | no | CHECK, nine values: `overview, scope, stakeholders, process, data_model, constraints, integrations, glossary, open_questions` |
| position | integer | no | default `0`. Order within a section |
| statement | text | no | One assertion. A ```` ```mermaid ```` fence here makes it a diagram — **a diagram is not a type and has no column** |
| confidence | varchar(16) | no | CHECK `IN ('stated','implied','uncertain')` |
| origin | varchar(8) | no | CHECK `IN ('ai','human')` |
| state | varchar(16) | no | default `'proposed'`. CHECK `IN ('proposed','accepted','rejected','superseded')`. `accepted` is the live page; nothing is ever deleted, so a rejection and a supersession both survive with their sources |
| kind | varchar(8) | no | default `'add'`. CHECK `IN ('add','update','conflict')` |
| supersedes_id | uuid | yes | Self-FK → `knowledge_blocks(id)` **ON DELETE RESTRICT** |
| source_document_id | uuid | yes | FK → `project_documents(id)` **ON DELETE RESTRICT**. Null for a human-authored block |
| edited_at | timestamptz | yes | Set when a human edits the statement. **A block with this set can only ever receive a `conflict`, never an `update`** — enforced in the prompt and again server-side |
| created_by | uuid | no | FK → `users(id)` **ON DELETE RESTRICT** |

Cross-column CHECK: `(kind = 'add' AND supersedes_id IS NULL) OR (kind <> 'add' AND
supersedes_id IS NOT NULL)`. An update or conflict with no target is meaningless, and a server
bug that produced one would otherwise be invisible.

**Composite index `(project_id, state)` — the repo's first index created for its own query
plan.** The page query is "accepted blocks of this project" and the review query is "proposed
blocks of this project"; both filter on exactly that pair. This settles what `schema.md`
previously listed as still open.

### `knowledge_refs` — a citation from a block back to a document
`backend/src/context/knowledge-ref.entity.ts` · same migration

| col | type | null | note |
|---|---|---|---|
| id | uuid | no | PK, uuidv7 |
| created_at / updated_at | timestamptz | no | default `now()` |
| block_id | uuid | no | FK → `knowledge_blocks(id)` **ON DELETE CASCADE** · `@Index()` |
| document_id | uuid | no | FK → `project_documents(id)` **ON DELETE RESTRICT** · `@Index()` — powers "which blocks cite this document" |
| locator | varchar(64) | yes | `p.12` / `§3.2` / `line 44`. Null when the parser can locate nothing, and null **by rule** for derived blocks (the project brief, diagrams), which cite a document rather than a span |
| quote | text | no | Verbatim snippet. Checked against the extracted text before the block is ever persisted — a fabricated citation is the one failure that makes the page worse than empty |

A table rather than a JSONB column, because all three reads are index lookups here and
sequential scans there: "which blocks cite document X", the membership join that authorises a
download, and orphan detection. **This leaves the JSON-column question still open** — nothing
here forces it.

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
| **On delete** | **RESTRICT is still the default.** CASCADE would silently erase records and, where files are involved, orphan bytes on disk that no FK can clean up. **Three exceptions exist, and they share one test: does the child own bytes or meaning outside its parent?** `project_members.project_id`, `project_documents.project_id` and `knowledge_blocks.project_id` / `knowledge_refs.block_id` all answer no, so cascading there cannot orphan anything a FK can't reach. Everything pointing at `files`, `users` or `project_documents` stays RESTRICT — `project_documents.file_id` in particular, which is why deleting a project would remove its documents, blocks and refs but **never a file row or a byte on disk**. `files.uploaded_by` stays RESTRICT for that original reason. **Apply the test, do not read three exceptions as a trend** | `file.entity.ts`, `project-member.entity.ts`, `project-document.entity.ts`, `knowledge-ref.entity.ts` |
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

## Settled by `add-project-context`

| Was open | Now |
|---|---|
| composite **index** for a query plan | `knowledge_blocks (project_id, state)`, declared with `@Index(['projectId','state'])`. The first index in this repo created for a query plan rather than falling out of a constraint |
| `ON DELETE CASCADE` | Two more edges, under the stated test — see the on-delete convention row. The test, not the count, is what the next change should copy |
| self-referencing FK | `knowledge_blocks.supersedes_id` → `knowledge_blocks(id)` RESTRICT. History must not disappear underneath a chain |
| cross-column CHECK | `(kind = 'add') = (supersedes_id IS NULL)` on `knowledge_blocks`. A CHECK can reference several columns of the same row; use it when a pairing would otherwise only be enforced in code |

## Still not established
Money and JSON column types. **The JSON question is still open on purpose**: citations went to
their own table (`knowledge_refs`) because every read of them is an index lookup, so nothing
yet forces a JSONB decision. Decide on the first table that genuinely needs a schemaless
column and refresh this file.
