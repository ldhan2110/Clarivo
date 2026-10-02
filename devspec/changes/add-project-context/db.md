# DB: add-project-context

**Source**: postgres (live) — `psql` against the running DB (`DATABASE_HOST:5437`, db `clarivo`), 2026-10-02.
**Dialect**: postgresql 17 (per `conventions.md` backend block). TypeORM, snake_case columns — **no naming strategy configured**, so every column needs an explicit `name:`; a forgotten one ships camelCase. PK = uuid, uuidv7 generated in app. `created_at`/`updated_at` timestamptz default `now()` via `BaseEntity`.

> **This supersedes the dropped block model.** `CreateProjectContext` created `project_documents` + `knowledge_blocks` + `knowledge_refs`; `DropProjectContext` removed all three. Live DB today holds only `users, files, projects, project_members, migrations`. The new design keeps **one** of those ideas (`project_documents`, reshaped) and replaces the block/ref/review machinery with **one summary markdown per project**.

## Live tables this change attaches to (all exist, unchanged)

### projects (exists — FK target)
| col | type | null | note |
|-----|------|------|------|
| id | uuid | no | PK |
| domain | varchar(255) | no | feeds the blank-project context |
| objective | text | yes | feeds the blank-project context |
| customer_bu | varchar(255) | no | the "who" web-research searches for |

### files (exists — FK target for doc sources)
| col | type | null | note |
|-----|------|------|------|
| id | uuid | no | PK |
| original_name | varchar(255) | no | document title |
| mime_type | varchar(127) | no | parser dispatch (pdf/docx/txt/md) |
| size_bytes | integer | no | — |
| uploaded_by | uuid | no | FK → users |

### project_members (exists — download authorisation)
`project_id` + `user_id` + `role`. The join that authorises `GET /files/:id` for a doc-backed source.

## Tables touched

### project_documents (new — a source, document OR web page)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | uuid | no | — | PK, uuidv7 |
| created_at / updated_at | timestamptz | no | now() | base entity |
| project_id | uuid | **add** | — | FK → projects(id) **ON DELETE CASCADE** · `@Index()` (project-owned; cascade safe per schema.md test) |
| source_type | varchar(8) | **add** | — | CHECK `IN ('doc','web')` |
| file_id | uuid | **add** | — | FK → files(id) **ON DELETE RESTRICT**. Set for `doc`, null for `web` |
| url | varchar(2048) | **add** | — | Set for `web`, null for `doc` |
| title | varchar(255) | **add** | — | document original_name, or web page/company title |
| extracted_text | text | **add** | — | parsed doc text / fetched web extract. The parse cache the summary reads — **open question** below |
| status | varchar(16) | **add** | 'new' | CHECK `IN ('new','processing','processed','failed')`. Drives "Process all" |
| failure_reason | text | **add** | — | readable error ("scanned image, OCR unsupported") |
| processed_at | timestamptz | **add** | — | null until processed |
| uploaded_by | uuid | **add** | — | FK → users(id) **ON DELETE RESTRICT** |

Integrity CHECK (source XOR): `(source_type='doc' AND file_id IS NOT NULL AND url IS NULL) OR (source_type='web' AND file_id IS NULL AND url IS NOT NULL)`.

### project_knowledge (new — the one summary.md per project)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | uuid | no | — | PK, uuidv7 |
| created_at / updated_at | timestamptz | no | now() | base entity |
| project_id | uuid | **add** | — | FK → projects(id) **ON DELETE CASCADE** · **UNIQUE** (one page per project) |
| summary_md | text | **add** | '' | the markdown — sections + ```mermaid diagram blocks inline. No separate diagram table |
| edited | boolean | **add** | false | human touched it → `[Regenerate]` warns before clobber |
| generated_at | timestamptz | **add** | — | last AI regeneration |

### Dropped model — do NOT recreate
`knowledge_blocks`, `knowledge_refs` — removed by `DropProjectContext`, and the new design has no blocks/citations-as-rows/review-queue. Citations live as a `Sources:` line inside `summary_md`; diagrams live as mermaid blocks inside `summary_md`. Coverage/section-count tiles are **computed from `summary_md` headings, not stored.**

## Impact
- **No readers in the tree** — the old context module (`src/context/*`) was removed; nothing reads these tables today. Fresh surface.
- **`GET /files/:id` download auth** — `src/files/` controller. A file whose id backs a `project_documents(source_type='doc')` row must require `project_members` membership. New join; spec it in the files section. Web sources have no `file_id`, so they never hit this path.
- **Seam — `files`**: doc uploads go through the existing `FilesService` (files table unchanged). `project_documents.file_id` RESTRICT means deleting a project cascades its documents but **never a `files` row or bytes on disk** (schema.md rule).

## Migration
- **Purely additive.** Two new tables, three FKs, one unique constraint, two indexes, two CHECKs. **No existing table/column altered or dropped. No backfill.** (The old tables are already gone via `DropProjectContext`.)
- Forward migration `17xxxxxxxxxxx-CreateProjectKnowledge.ts` in `backend/src/database/migrations/` (TypeORM, same pattern as `CreateProjects`). Reverts clean by dropping the two tables in FK order (`project_documents` has no child now).
- **No destructive op in tasks.** The block tables are already dropped; nothing here DROPs.

## Open questions
- **`extracted_text` — store or not?** You said "don't store raw web search." Storing the parsed/fetched extract (not raw search results, not chunks, not embeddings — just the text the summary was built from) lets `[Regenerate]` re-run without re-parsing a 1.2MB PDF or re-hitting Tavily. Omitting it means Regenerate re-parses docs and re-searches the web every time. **Lean: store it** (one text column, not RAG) — confirm.
- **Regenerate vs `edited`**: if `edited=true`, does `[Regenerate]` block, warn-and-overwrite, or diff? (old design never auto-overwrote a human.) Behavioural, settle in spec.
- **`url` length 2048** — standard cap; fine unless you expect longer.
- **AI env vars** (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG`) + `TAVILY_API_KEY` — new required env; every `.env` breaks until added. Not DB, but same migration-of-config risk; capture into `env.validation.ts`.
