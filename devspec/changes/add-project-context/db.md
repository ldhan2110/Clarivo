# DB: add-project-context

**Source**: live Postgres — `docker exec clarivo-postgres-1 psql -U clarivo -d clarivo` (no DB MCP is connected). Read-only; `\d` + row counts only.
**Dialect**: postgresql 17 · **Schema**: `public` · **Migration dir**: `backend/src/database/migrations/`
**Applied migrations**: `CreateUsers1790762306910`, `CreateFiles1790827127817`, `CreateProjects1790842205065`. This change is the **fourth**.
**Live row counts**: `users` 3 · `files` 6 · `projects` 49 · `project_members` 50.

## Tables touched

### `files` (exists) — **no column change**
Confirmed live, byte-for-byte as `devspec/context/schema.md` describes it:
`id`, `created_at`, `updated_at`, `storage_key` (UNIQUE), `original_name`, `mime_type varchar(127)`,
`size_bytes integer`, `uploaded_by uuid → users(id) ON DELETE RESTRICT`. PK + one unique index, no other index.

This change adds **no column here**. It makes `files` a referenced table for the first time —
`project_documents.file_id` is the first FK pointing at it, which is exactly what
`schema.md` predicted ("a consuming domain table adds its own `file_id`").

The upload allowlist in `backend/src/files/files.constants.ts` already permits every type this
change needs — `application/pdf`, `…wordprocessingml.document` (.docx), `text/plain`,
`text/markdown`. **No allowlist change.**

### `project_documents` (new) — one row per uploaded context document
| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | — | PK, uuid v7 in the app via `BaseEntity` |
| created_at / updated_at | timestamptz | no | `now()` | `BaseEntity` |
| project_id | uuid | no | — | **add** · FK → `projects(id)` **ON DELETE CASCADE** · `@Index()` — every query starts "documents of this project" |
| file_id | uuid | no | — | **add** · FK → `files(id)` **ON DELETE RESTRICT** · **UNIQUE** — one file backs at most one document row |
| title | varchar(255) | no | — | **add** · seeded from `files.original_name`, editable afterwards |
| status | varchar(16) | no | `'pending'` | **add** · CHECK `IN ('pending','parsing','summarizing','proposing','ready','failed','archived')`. *(worker correction: `'archived'` was missing here — design.md Default 25 makes archiving a status change, and req-14 needs it)* |
| error | text | yes | — | **add** · failure reason, shown in the UI; null unless `status='failed'` |
| char_count | integer | yes | — | **add** · extracted plain-text length. `integer`, not `bigint` (TypeORM returns bigint as a JS string) |
| digest | text | yes | — | **add** · the map-reduce document summary. The expensive artifact — stored so a re-propose costs no AI call |
| uploaded_by | uuid | no | — | **add** · FK → `users(id)` **ON DELETE RESTRICT** |

Extracted raw text is **not** stored. The bytes are already on disk and re-parsing is free;
only `digest` costs money, so only `digest` is persisted.
<!-- ponytail: re-parse from disk when text is needed again. Add an extracted_text column only if re-parse shows up in a profile. -->

### `knowledge_blocks` (new) — the merged knowledge page, and its proposal queue
One table carries the live page, the pending proposals and the history. A separate proposals
table plus a separate audit table would hold the same rows in three shapes.

| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | — | PK, uuid v7 in the app. **Stable id is what the whole design rests on** — it lets AI patch one block instead of rewriting the page |
| created_at / updated_at | timestamptz | no | `now()` | `BaseEntity` |
| project_id | uuid | no | — | **add** · FK → `projects(id)` **ON DELETE CASCADE** |
| section | varchar(16) | no | — | **add** · CHECK `IN ('overview','scope','stakeholders','process','data_model','constraints','integrations','glossary','open_questions')`. *(worker correction: this row listed seven; design.md and tasks.md 2.2 both say the nine above)* |
| position | integer | no | `0` | **add** · order within a section |
| statement | text | no | — | **add** · markdown, one assertion |
| confidence | varchar(16) | no | — | **add** · CHECK `IN ('stated','implied','uncertain')` |
| origin | varchar(8) | no | — | **add** · CHECK `IN ('ai','human')` |
| state | varchar(16) | no | `'proposed'` | **add** · CHECK `IN ('proposed','accepted','rejected','superseded')` |
| kind | varchar(8) | no | `'add'` | **add** · CHECK `IN ('add','update','conflict')` — what this row proposes |
| supersedes_id | uuid | yes | — | **add** · self-FK → `knowledge_blocks(id)` **ON DELETE RESTRICT**. The block this one replaces (update) or disagrees with (conflict) |
| source_document_id | uuid | yes | — | **add** · FK → `project_documents(id)` **ON DELETE RESTRICT**. Which document's propose run produced it; null for a human-authored block |
| edited_at | timestamptz | yes | — | **add** · set when a human edits the statement. **A block with `edited_at` set is never auto-superseded** |
| created_by | uuid | no | — | **add** · FK → `users(id)` **ON DELETE RESTRICT** |

Constraints beyond the CHECKs above:
- CHECK `(kind = 'add' AND supersedes_id IS NULL) OR (kind <> 'add' AND supersedes_id IS NOT NULL)` — an update or conflict with no target is meaningless, and a server bug that produced one would otherwise be invisible.
- Composite index `(project_id, state)` — the page query is *"accepted blocks of this project"* and the review query is *"proposed blocks of this project"*. **This is the repo's first composite index created for its own query plan**; `schema.md` lists that as "still not established", so this change settles it. Refresh `schema.md` accordingly.

### `knowledge_refs` (new) — citation from a block back to a document
| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | — | PK, uuid v7 in the app |
| created_at / updated_at | timestamptz | no | `now()` | `BaseEntity` |
| block_id | uuid | no | — | **add** · FK → `knowledge_blocks(id)` **ON DELETE CASCADE** · `@Index()` |
| document_id | uuid | no | — | **add** · FK → `project_documents(id)` **ON DELETE RESTRICT** · `@Index()` — powers "which blocks cite this document" |
| locator | varchar(64) | yes | — | **add** · whatever the parser can honestly report: `p.12` for pdf, `§3.2` for docx/md headings, `line 44` for txt. Null when the parser can locate nothing |
| quote | text | no | — | **add** · verbatim snippet from the source. This is what a reviewer checks the statement against |

A table rather than a JSONB column on the block, for three reasons that are index lookups
here and sequential scans there: (1) "which blocks cite document X", needed before a document
can be archived, (2) the membership join that authorises a download, (3) orphan detection.
This keeps `schema.md`'s open "JSON column types" question **still open** — nothing here forces it.

## On delete — two CASCADEs, and why they are not a precedent

`schema.md` records RESTRICT as the default with exactly one reasoned exception
(`project_members.project_id`) and warns against reading it as blanket permission. This change
adds two more under the *same* test — **does the child own bytes or meaning outside its parent?**

- `project_documents.project_id` → CASCADE. A context document has no meaning outside its project. **It does not own the bytes**: `files` is a separate table and `project_documents.file_id` is RESTRICT, so cascading a project away leaves the file row and the disk bytes intact and still reachable. Nothing is orphaned that no FK can reach.
- `knowledge_blocks.project_id` and `knowledge_refs.block_id` → CASCADE. Same test: no external bytes, no meaning without the parent.
- Everything pointing at `files`, `users` or `project_documents` stays **RESTRICT**. `files.uploaded_by` stays RESTRICT for the original reason — cascading there would orphan bytes on disk that no FK can clean up.

Net effect: deleting a project row would delete its documents, blocks and refs but **never a
file row or a byte on disk**. There is no project-delete path in the code today (archive is
`status='archived'`), so this is defensive, not a behaviour.

## Impact

- **`FilesController.download` (`backend/src/files/files.controller.ts:88`) is a security hole that widens with this change.** It is `@UseGuards(JwtAuthGuard)` and nothing else — any authenticated user can download any file by id. `add-file-storage` logged that as known-and-accepted precisely because no file had an owner yet. After this change a file *does* have an owner, so the endpoint must additionally require project membership when the file has a `project_documents` row. One extra query in `FilesService` or a project-aware guard.
- The 6 live `files` rows are `add-file-storage` test leftovers. None will have a `project_documents` row, so under the rule above they keep today's behaviour — the tightening is not retroactive and needs no data fix.
- **Reuse `ProjectsService.requireMembership` (`backend/src/projects/projects.service.ts:98`)** — signature `(projectId, viewerId, { owner?: boolean })`, throws `PROJECT_NOT_FOUND` (404) for a non-member and `PROJECT_NOT_OWNER` (403) for a member attempting an owner-only write. Do not write a second gate; `add-projects` deliberately put it inside the service "so no future caller can route around it".
- `FilesService.store` (`backend/src/files/files.service.ts:61`) and `.findById` (`:97`) are reused unchanged — the document upload path stores through `FilesService`, then writes its own `project_documents` row.
- `FilesService.remove` (`:117`) is **not** called by this change. Documents archive, they do not delete.
- `backend/src/app.module.ts` gains one import registering the new module. `entities: []` + `autoLoadEntities: true` means `TypeOrmModule.forFeature([ProjectDocument, KnowledgeBlock, KnowledgeRef])` inside that module is the **only** thing that registers these entities — registering them anywhere else is a silent no-op.
- `backend/src/config/env.validation.ts` + `.env.example` gain the AI provider contract (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG`). Required with no code default, per `rules.md` ("Don't add `?? 'default'` fallbacks"), so **every existing `.env` becomes invalid until the vars are added** — the same cost `FILE_STORAGE_PATH` imposed once. The `.env.example` rows and a line in the commit message are what make that survivable.
- `frontend/app/types/api/**` is regenerated by `pnpm api:types`. Never hand-edited.
- **Migration verdict: purely additive.** Three new tables, seven FKs, one unique constraint, one composite index, two single-column indexes, six CHECK constraints. **No column on an existing table is added, altered or dropped. No backfill. No destructive operation anywhere.** It reverts clean by dropping the three tables in FK order (`knowledge_refs` → `knowledge_blocks` → `project_documents`).
- `pnpm migration:*` builds first and runs against `dist/` — compile clean before generating, or a TypeScript error surfaces as a confusing migration failure.

## Open questions

- **AI env vars required or optional?** Recommended **required**, matching the `JWT_SECRET` / `FILE_STORAGE_PATH` precedent and `rules.md`. The cost is real: a frontend-only developer cannot boot the backend without an API key. The alternative is `@IsOptional()` plus a document that fails with a clear "AI not configured" error — cheaper for contributors, but it moves a boot-time failure to run time, which is the thing env validation exists to prevent.
- **Rejected and superseded blocks are never deleted.** They accumulate, which is what gives traceability. Nothing prunes them. A prune path would be a destructive DB operation and is deliberately out of scope — flagged here for a human rather than specced.
- **`locator` for `.docx`.** Whether a heading path is recoverable depends on the parser (`mammoth` yields HTML, from which headings are derivable; a plain-text extractor is not). If the chosen parser cannot report one, `locator` is null and the `quote` carries the whole burden of verification. Decide when the parser is picked, not now.

## Verify hooks for tasks.md

- **Schema assertion** — a test that asserts each new table exists with the exact column names, nullability and CHECK constraints. `backend/src/files/file.entity.spec.ts` is the pattern: it asserts snake_case per column, which matters here because **no naming strategy is configured** — a forgotten `name:` ships a camelCase column.
- **Migration runs clean** — `pnpm migration:run` then `pnpm migration:revert` on the local DB, with `\d` before and after proving the three tables appear and disappear.
- **No regression** — `pnpm test` (the backend gate). **Do not run `pnpm test:e2e`**: `backend/test/app.e2e-spec.ts` is a pre-existing failure logged in `devspec/report/blockers.md`.
