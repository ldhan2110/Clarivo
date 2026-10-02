# Design: add-project-context

## The commitment

Sources are read **once** into a single markdown summary; the raw bytes never re-enter a prompt.
No embeddings, no retrieval. The `summary.md` is the only thing downstream reads — so it must be
**editable by a human** and **cite its sources**. "No RAG" does not mean "no chunking": a 300-page
PDF still exceeds a context window, so summarisation is a map-reduce over segments. That is
compression, not retrieval.

## Architecture

```
Documents ─ POST /projects/:id/documents ─▶ FilesService ─▶ project_documents(source_type=doc, status=new)
Web      ─ POST /projects/:id/research ───▶ TavilyClient ─▶ draft findings
                    └ POST /projects/:id/research/accept ─▶ project_documents(source_type=web, status=new)

Process  ─ POST /projects/:id/context/process ─▶ ContextService.processAll (background)
             for each new source:  Parser(doc) | TavilySearch(web) ─▶ extracted_text, status=processed|failed
             then:  AiClient (ChatOpenAI)  map(FAST per segment) ─▶ reduce(STRONG) ─▶ summary_md (+ ```mermaid)
                                                                  ─▶ project_knowledge(summary_md, generated_at)

Read     ─ GET /projects/:id/context ─▶ { summary_md, sources[], coverage, status }
Edit     ─ PUT /projects/:id/context/summary ─▶ summary_md, edited=true
Regen    ─ POST /projects/:id/context/regenerate(force?) ─▶ AiClient.summarise (blocked if edited && !force)
Download ─ GET /files/:id (FilesController.download) ─▶ if backed by a project_document, require project membership
```

Boot-time sweep: `ContextService.onModuleInit` flips any `status=processing` row (from a crashed run)
to `failed` so nothing is stuck forever. `ponytail:` comment names the job-queue upgrade.

## Key approaches, and what was rejected

| Decision | Chosen | Rejected |
|---|---|---|
| Knowledge representation | One `summary_md` text column | Block rows + `knowledge_refs` + review queue — the reverted shape, heavier and plainer |
| Diagrams | ```mermaid inside `summary_md`, rendered client-side (`mermaid` lib) | A diagrams table / server-side render — a diagram is just markdown |
| Citations | Inline `Sources:` line in the markdown | A citation table — not needed without blocks |
| Processing | One Process-all, in-process background, status column + boot sweep | Per-document pipeline (reverted); a job queue (no second instance runs) |
| AI client | **LangChain `ChatOpenAI`** (`@langchain/openai`) pointed at `AI_BASE_URL`, FAST/STRONG split; map-reduce via LangChain text splitters + a chain; structured output via LangChain output parsers | Raw `fetch` (less reusable once the agent lands, and re-wrapped as a tool later anyway); a single-vendor SDK |
| Web search | **LangChain `TavilySearch`** (`@langchain/tavily`) — the *same tool* the LangGraph discovery agent will call later | Raw Tavily REST (would need re-wrapping as a LangChain tool for the agent) |
| Agent orchestration (later change) | **LangGraph** (`@langchain/langgraph`) `StateGraph` + checkpointer for the discovery agent's multi-turn / human-in-the-loop | Hand-rolled loop (reimplements the checkpointing the multi-turn agent needs) |
| Web intake | Two-step: search → confirm → accept | Auto-fold search results (a bad hit would silently pollute the summary) |
| Parsers | `pdf-parse` + `mammoth` (installed, CJS-safe) | An ESM-only parser — breaks the build |

### Dependency note — LangChain under CommonJS
The BA chose LangChain / LangGraph for forward extensibility (the discovery agent reuses the same
`ChatOpenAI` model wrapper and `TavilySearch` tool, then adds a LangGraph `StateGraph`). The backend
is CommonJS (`"type":"commonjs"`, `module:nodenext`), and `conventions.md` forbids ESM-only deps —
but these packages are **dual-published**: their `exports["."]` carry a `require` condition → `.cjs`
(`@langchain/core` 1.x, `@langchain/openai` 1.x, `@langchain/tavily` 1.x, `@langchain/langgraph` 1.x,
verified on npm 2026-10-02). So they load under `require` / nodenext. **A spike confirming they
actually resolve and run under this repo's build is task 0 — before any code depends on them.**
New deps this change adds: `langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/tavily`.
`@langchain/langgraph` is deferred to the discovery-agent change.
<!-- ponytail: LangChain is heavier than a linear map-reduce strictly needs; justified only because the agent change reuses the same model + tool. If the agent is ever cut, this collapses back to a fetch client. -->



## Data shapes

Full schema in `db.md`. In short:
- `project_documents` — a source (doc XOR web): `source_type`, `file_id|url`, `title`,
  `extracted_text`, `status (new|processing|processed|failed)`, `failure_reason`, `processed_at`.
- `project_knowledge` — one per project (UNIQUE `project_id`): `summary_md`, `edited`, `generated_at`.

Request/response (response DTOs extend `AuditDto`, `@Expose()` per field):
- `ContextDto` — `{ summary_md, edited, generated_at, status, coverage: {covered, total}, sources: SourceDto[] }`
- `SourceDto` — `{ id, source_type, title, url?, status, failure_reason?, processed_at? }` (never `extracted_text`)
- `ResearchDraftDto` — `{ findings_md, pages: {title, url}[] }`
- `ResearchRequestDto` — `{ companyName?, url?, building? }` (at least one of name/url; `whitelist` on)
- `UpdateSummaryDto` — `{ summary_md }`

## Integration points

- **FilesService** (`src/files/files.service.ts`) — document uploads reuse it unchanged; `project_documents.file_id` → `files.id`.
- **FilesController.download** (`src/files/files.controller.ts:91`, `@Get('files/:id')`) — tightened: if the file id backs a `project_documents(source_type=doc)` row, require the caller be a `project_members` row for that project. `file.entity.ts` already documents this intent.
- **ProjectsService** (`src/projects/projects.service.ts`) — membership lookup for the download check and context authorisation; `ProjectMember` entity exists.
- **Domain errors** — `defineErrors('CONTEXT', {...})` (`src/common/exceptions/domain-errors.ts` pattern); never raw `HttpException`.
- **Env** — new vars on `EnvironmentVariables` (`src/config/env.validation.ts`) + `.env.example`.

## Impact Area

### Decision Defaults (worker resolves these without stalling)

| Gray area | Default |
|---|---|
| Regenerate when `edited=true` | Block with a `CONTEXT_SUMMARY_EDITED` error unless `force:true` in the body; the UI shows a confirm dialog that resends with `force` |
| A source yields no extractable text | `status=failed`, `failure_reason` set to a readable reason; Process-all continues with the rest; summary is generated from whatever succeeded |
| Tavily returns zero results | `research` returns `{ findings_md: "", pages: [] }` with a 200; the UI shows "nothing found", no rows created |
| `extracted_text` for web | Store Tavily's returned extract text only; never store raw search JSON, never chunk/embed |
| Segment size for map step | Group by headings/pages up to a fixed char budget; a single-group source skips the map and goes straight to reduce |
| Mermaid the model emits is invalid | Keep it in the markdown as a fenced block; the client renders what it can and shows the code block for the rest — a bad diagram never fails the run |
| Process-all with nothing new | No-op 200; status reflects the existing summary |
| Which model where | `AI_MODEL_FAST` for the per-segment map; `AI_MODEL_STRONG` for the reduce + diagram pass (runs once) |
| Download of a web source | Web sources have no `file_id`; `GET /files/:id` never applies to them |
| Coverage number | Computed from `##` headings present-and-non-thin in `summary_md`; not stored |

### Blast Radius

- **`files` table / FilesService** — unchanged structurally. Only `FilesController.download` gains a membership check. Existing upload/download tests must still pass (no-regression). (`src/files/files.controller.ts:91`, `files.service.ts:98`)
- **`projects` / `project_members`** — read-only here (membership lookup). No change to project CRUD. (`src/projects/projects.service.ts`)
- **Migrations pipeline** — the project has run migrations before (users/files/projects); this adds one. `synchronize:false` everywhere, so schema only moves via the migration. Build-first `migration:*` scripts run against `dist/`.
- **Env contract** — five new vars; the process dies at boot on a missing one (by rule). Every `.env` and `.env.example` must be updated or the app won't start.
- **Frontend** — new route `app/(app)/projects/[id]/context/page.tsx`, the sidebar `Context` row, Overview stage-1 count. No shared `components/ui/` exists today (reverted) — shadcn primitives are added by hand. New dep `mermaid`.

### Risk / reversibility

- **DB**: additive, reverts clean (drop the two new tables in FK order). **Low risk.**
- **Security**: the download tightening is a real authz change — `high` attention, covered by a scenario (member downloads, non-member 403).
- **AI/Tavily**: external calls, cost and latency. `medium` — behind config, failures degrade to `failed`/empty, never crash.
- **Env**: `medium` — a missing var is a hard boot failure by design; mitigated by updating `.env.example` in the same change.

## Open questions (for a human, not the worker)

- **Pruning failed / superseded sources** — sources accumulate; nothing deletes them. A prune path is a
  destructive DB op, deliberately out of scope and flagged here.
- **Re-uploading the same filename** — a new source row; both coexist. No document-level supersede.
