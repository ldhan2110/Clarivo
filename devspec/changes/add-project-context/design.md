# Design: add-project-context

## The one decision everything else follows from

Documents are summarised **once**, into a knowledge page, and the raw bytes never enter a prompt
again. No embeddings, no vector store, no retrieval at query time.

That makes the knowledge page a **contract, not a convenience**: it is the only thing downstream
features (discovery plan, meeting scaffold, requirements) will ever read. Three properties stop
being polish and become structural.

1. **A human must own the page.** AI output is a draft. Every block is editable, deletable and
   hand-authorable.
2. **Every statement cites its source.** A lossy summary is only trustworthy if you can reach page
   12 of the SRS in one click.
3. **AI never writes the page — it proposes.** Nothing mutates the page without a human accept.

"No RAG" means no embeddings and no similarity search. It does **not** mean no chunking: a
300-page PDF still exceeds any context window, so extraction is a map-reduce over pages and
headings. That is compression, not retrieval.

## Architecture

```
UPLOAD
  POST /projects/:id/documents (multipart)
    → ProjectsService.requireMembership        (existing gate, reused)
    → FilesService.store                       (existing, writes files row + disk)
    → project_documents row { status: 'pending' }
    → 201 returns immediately
    → ContextPipeline.run(documentId)          fire-and-forget, in-process

PIPELINE  (status walks the row)
  pending
    → parsing       DocumentParser.extract(file) → [{ text, locator }]
    → summarizing   map:    AiClient(MODEL_FAST)   per segment group → partial summaries
                    reduce: AiClient(MODEL_STRONG) → project_documents.digest
    → proposing     ProposalGenerator: digest + current accepted blocks
                    → AiClient(MODEL_STRONG) → [{ kind, section, statement, confidence, quote, locator }]
                    → QuoteGuard: drop any proposal whose quote is not verbatim in the extracted text
                    → knowledge_blocks rows { state: 'proposed' }
    → ready | failed(error)

REVIEW
  GET  /projects/:id/knowledge/proposals        state='proposed'
  POST /projects/:id/knowledge/proposals/:id/accept
        add      → state='accepted'
        update   → state='accepted', target.state='superseded'
        conflict → chosen side accepted, other rejected (both kept, with sources)
  POST .../reject                               → state='rejected'

BRIEF
  POST /projects/:id/knowledge/brief/regenerate
    → every project_documents.digest + project.domain/objective/customerBu + accepted blocks
    → AiClient(MODEL_STRONG) → one 'overview' block, kind='update', state='proposed'

READ
  GET /projects/:id/knowledge                   accepted blocks + refs, grouped by section
  GET /files/:id        ← TIGHTENED: a file with a project_documents row requires membership
```

Frontend: `app/projects/[id]/context/page.tsx` → `hooks/use-context-documents.ts` /
`use-knowledge.ts` → `services/context.ts` → `lib/api`. The layer law from `frontend/CLAUDE.md`
holds: a component never calls `api.*`.

## Data shapes

The live schema, migration verdict and every column live in **`db.md`** — read it, not this
section. Three new tables: `project_documents`, `knowledge_blocks`, `knowledge_refs`.

The design-relevant part is that **one table carries the live page, the proposal queue and the
history**, discriminated by `state`:

```
state      meaning
proposed   in the review queue, invisible on the page
accepted   on the page now
rejected   a human said no; kept with its source so the disagreement survives
superseded a human accepted something that replaced it; kept as history
```

and `kind` says what a proposal does: `add` (no target), `update` / `conflict` (a `supersedes_id`
target). A CHECK constraint enforces that pairing, so a server bug cannot produce a dangling
update.

**Nine sections**, `varchar` + CHECK: `overview`, `scope`, `stakeholders`, `process`,
`data_model`, `constraints`, `integrations`, `glossary`, `open_questions`.

**A diagram is not a type.** It is a block whose `statement` contains a ` ```mermaid ` fence.
Same edit, supersede and citation flow; only the renderer is new.

## The AI contract

**Two models, by cost.** `AI_MODEL_FAST` for the map step (runs once per segment group, the bulk
of the tokens); `AI_MODEL_STRONG` for reduce, propose and brief (runs once each, and is where
quality shows).

**One OpenAI-compatible client over native `fetch`.** `AI_BASE_URL` + `AI_API_KEY` + the two model
names. OpenRouter, Omniroute and direct providers all speak this shape. No vendor SDK, no provider
registry, no interface with one implementation.

**Every AI call returns JSON matching a declared schema**, validated with `class-validator` the
same way a request body is. A malformed response is retried once and then fails the document with
a readable error — it never half-writes blocks.

**The QuoteGuard is the hallucination defence.** Every extracted proposal must carry a `quote`;
the server checks that quote appears **verbatim** in the document's extracted text (whitespace
normalised) and silently drops any proposal that fails. A fabricated citation is the one failure
mode that makes the page worse than empty, and this is a mechanical check, not a prompt
instruction.

**Two block kinds are exempt from QuoteGuard**, and the exemption is explicit rather than
implicit: the **project brief** and **diagram blocks** are *derived*, synthesised from digests and
accepted blocks rather than extracted from a span of text. There is no verbatim span to check.
They carry document-level citations (`locator` null) instead, and the UI presents them as derived.

**The brief reads everything at once.** Its input is every document's digest, plus the project's
own `domain` / `objective` / `customerBu`, plus the accepted blocks. That is deliberate: a brief
assembled only from the bullets could never say something the bullets do not, which is exactly the
cross-document synthesis a reader wants. The cost is that the brief may contain a fact no block
states — accepted, and the reason it cites documents rather than blocks. It regenerates only on
request; when documents have been read since it was written, the UI says so by count instead of
silently refreshing.

## Async without a queue

The repo has no job runner. The honest floor:

- The upload request writes the row and returns; the pipeline runs **in-process, fire-and-forget**.
- Progress is the `status` column. The frontend polls (`refetchInterval`) while any row is
  non-terminal and stops when none is.
- **A boot-time sweep** fails any row left non-terminal for more than 30 minutes. Without it, one
  restart leaves zombie rows that never resolve and a UI that polls forever.
- Concurrency is capped at 2 documents in flight per process, so ten uploads do not open ten
  simultaneous model calls.

`// ponytail: in-process, single instance. pg-boss when a second instance exists.`

## Rejected approaches

| Rejected | Why |
|---|---|
| **RAG / embeddings** | The explicit product decision. It also would not remove the need to chunk, only add a store to operate |
| **One prose blob per project** | Cannot be diffed, cited per statement, or patched by an AI without rewriting the whole thing — which loses human edits on every upload |
| **Per-document summary pages as the UI** | The user wants one merged page. Per-document digests survive only as the pipeline intermediate |
| **AI rewrites the page directly** | The second upload would silently destroy the BA's corrections. Proposals exist for exactly this |
| **Auto-accepting proposals** | A page that mutates itself is a page nobody trusts. Not even behind a toggle in this change |
| **Clarivo resolving conflicts itself** | Picking a side hides the disagreement, which is the single most valuable thing a second document produces |
| **A separate proposals table + an audit table** | The same rows in three shapes. `state` + `supersedes_id` on one table gives the queue, the page and the history |
| **JSONB for citations** | "Which blocks cite this document", the download-authorisation join and orphan detection are all index lookups on a table and scans on JSONB |
| **Document-level supersede on re-upload** | The user chose coexisting rows. Old citations stay valid with no chain to maintain |
| **A job queue now** | Nothing runs a second instance. The sweep covers the actual failure |
| **A vendor SDK per provider** | One OpenAI-compatible client covers every target the user named |
| **Hand-copying a Radix Select** | The shadcn CLI hangs here and nine options do not justify it. A styled native `<select>` |
| **A new `isDiagram` column / block type** | `statement` is already markdown. A mermaid fence needs no schema |
| **Storing extracted text** | Only `digest` costs money. Re-parsing from disk is free |
| **OCR / vision for scanned PDFs** | Out of scope. A scan stores and downloads, learns nothing, and says so |

## Impact Area

### Decision Defaults

Pre-decided so the worker proceeds instead of stalling. Each is a human decision already made.

| # | Gray area | Default |
|---|---|---|
| 1 | Backend file layout | `backend/src/context/` mirroring `src/projects/`: `project-document.entity.ts`, `knowledge-block.entity.ts`, `knowledge-ref.entity.ts`, `context.service.ts`, `context.controller.ts`, `context.errors.ts`, `context.module.ts`, `dto/`, `*.spec.ts` **next to the source** |
| 2 | Where the AI client and parser live | `backend/src/ai/` (`ai.client.ts`, `ai.module.ts`, schemas) and `backend/src/context/parser/` (`document-parser.ts` + one file per format). The AI client is its own module because meetings will reuse it; the parser is not, because nothing else parses |
| 3 | Entity class names | `ProjectDocument`, `KnowledgeBlock`, `KnowledgeRef`. None shadows a Node global, so the `FileEntity` workaround does not apply |
| 4 | Entity registration | `TypeOrmModule.forFeature([ProjectDocument, KnowledgeBlock, KnowledgeRef])` inside `ContextModule` **only** — `app.module.ts` passes `entities: []` + `autoLoadEntities: true`, so registering anywhere else is a silent no-op |
| 5 | Error codes | `defineErrors('CONTEXT', …)`: `DOCUMENT_NOT_FOUND` (404), `BLOCK_NOT_FOUND` (404), `UNSUPPORTED_DOCUMENT` (400 — an allowed upload type that carries no text), `DOCUMENT_NOT_READY` (409 — reviewing proposals for a document still processing), `PROPOSAL_ALREADY_RESOLVED` (409), `DOCUMENT_ARCHIVED` (409), `AI_UNAVAILABLE` (502). Project-level failures keep reusing `ProjectErrors` |
| 6 | The membership gate | **Reuse `ProjectsService.requireMembership`** (`projects.service.ts:98`). Export it or move it to a small `ProjectAccess` provider both modules inject. **Do not write a second gate** — `add-projects` deliberately put it inside the service so no caller can route around it |
| 7 | Non-member on any context endpoint | 404 `PROJECT_NOT_FOUND`, never 403, exactly as `add-projects` settled. A 403 confirms the project exists |
| 8 | Owner-only vs member actions | **Every context action is member-level.** Uploading, editing blocks and reviewing proposals are the BA's daily work; restricting them to the owner would make a member a spectator. Project settings stay owner-only, unchanged |
| 9 | Archived project | Every write returns 409 `PROJECT_ARCHIVED`; reads and downloads still work. `ui.md` renders the controls disabled and the API agrees independently |
| 10 | `GET /files/:id` tightening | In `FilesController.download`, after loading the file, look up `project_documents` by `file_id`. No row → today's behaviour (any authenticated user). A row → `requireMembership(projectId, viewerId)`, which throws 404 for a non-member. One extra query, and it does not change behaviour for the 6 pre-existing orphan file rows |
| 11 | Document download route | Keep `GET /files/:id` as the single download path rather than adding a project-scoped duplicate — the citation chips already hold a file id, and two routes serving the same bytes is two places to get authorisation wrong |
| 12 | Upload transport | Reuse `FileInterceptor` + the multer config already registered in `FilesModule`, and call `FilesService.store`. The context endpoint adds the `project_documents` row after the file row exists |
| 13 | Upload size / type | Unchanged — `MAX_FILE_SIZE_BYTES` (100MB) and the existing `MIME_EXTENSIONS` allowlist, which already covers pdf/docx/txt/md. **No allowlist change.** An image uploads and downloads but produces no knowledge |
| 14 | PDF parser | `pdf-parse` (CommonJS). **Task 1 is a load spike** — the backend is CommonJS and an ESM-only parser breaks the build outright. If it fails to load, fall back to `pdfjs-dist`'s legacy CJS build and record the swap in this file |
| 15 | DOCX parser | `mammoth` (CommonJS), converting to HTML so heading structure survives and `locator` can be a `§` path. A plain-text extractor would force `locator` to null |
| 16 | TXT / MD | No dependency. MD segments on `#` headings (`locator = §<heading>`), TXT on blank-line paragraphs (`locator = line <n>`) |
| 17 | Segment size for the map step | ~6000 characters per group, merging whole segments so a locator is never split. Not a token count — a character budget needs no tokenizer dependency |
| 18 | Map/reduce model split | Map uses `AI_MODEL_FAST`, reduce/propose/brief use `AI_MODEL_STRONG`. A single-group document skips the map step and goes straight to reduce |
| 19 | AI response format | A JSON array matching a declared DTO, validated with `class-validator`. Malformed → retry once → fail the document with `AI_UNAVAILABLE` and a readable `error`. **Never half-write blocks** |
| 20 | QuoteGuard | Every *extracted* proposal must carry a `quote` that appears verbatim in the extracted text after whitespace normalisation; failures are dropped silently and counted in the log. Brief and diagram blocks are exempt (see above) and that exemption is in code, not prose |
| 21 | Proposals against an empty page | Still proposals, not auto-accepted. The first upload produces a queue of `add`s with an "Accept all" for the add-only subset — one click, and the model stays "nothing lands without a human" |
| 22 | A proposal targeting a human-edited block | Only ever `conflict`, never `update`. A block with `edited_at` set is excluded from the update path in the prompt **and** rejected server-side if the model proposes one anyway |
| 23 | Accepting a conflict | Three outcomes: keep existing (proposal → `rejected`), use new (proposal → `accepted`, target → `superseded`), write my own (a new human block supersedes the target, proposal → `rejected`). All three leave both sources recorded |
| 24 | Re-running a document | `⟳ Read again` discards that document's still-`proposed` blocks, re-runs propose from the stored `digest` (no re-parse, no map cost), and leaves accepted blocks alone |
| 25 | Archiving a document | A `status` change; its blocks and citations stay and stay resolvable, because an archived document is still downloadable. **There is no document delete anywhere in this change** |
| 26 | Brief regeneration trigger | Manual only. The UI shows a stale count when documents have been read since the brief was written. Auto-regeneration would burn tokens on every edit and churn prose the BA just fixed |
| 27 | Brief when there are no documents | Still generatable, from the project's own `domain` / `objective` / `customerBu` plus any human blocks. That is the blank-project path and it is the honest "everything needs asking" answer |
| 28 | Background execution | `void this.pipeline.run(id)` after the response, concurrency-capped at 2 per process, with a `OnModuleInit` sweep failing rows non-terminal for > 30 min. `ponytail:` comment names pg-boss as the upgrade |
| 29 | Polling | `refetchInterval` on the documents query while any row is non-terminal, `false` otherwise. No SSE, no websocket |
| 30 | Frontend layer placement | `services/context.ts` (one function per endpoint, returns unwrapped `data`), `hooks/use-context-documents.ts`, `hooks/use-knowledge.ts`, `hooks/use-proposals.ts`. Layer law: component → hooks → services → `lib/api` |
| 31 | Query keys | `['context', projectId, 'documents']`, `['context', projectId, 'knowledge']`, `['context', projectId, 'proposals']`. Accepting a proposal invalidates knowledge + proposals; an upload invalidates documents |
| 32 | Section picker | A native `<select>` styled with `input.tsx`'s classes. No `select.tsx` exists, the shadcn CLI hangs here, and nine options do not justify hand-copying Radix Select. `ponytail:` comment names the upgrade |
| 33 | Mermaid | `mermaid` from npm, **lazy-loaded** (`next/dynamic`, `ssr: false`) so a page with no diagram pays nothing. A render error renders the source in a monospace panel with the message — never a blank box |
| 34 | Markdown rendering in a block | `react-markdown` is **not** added. Statements render as plain text with the mermaid fence detected by a regex and routed to the renderer. Bold/links in a statement render literally; that is accepted, and adding a markdown renderer later is a one-component change |
| 35 | Form library | `react-hook-form` + `zodResolver`, schema beside the form, `z.infer` for the type, server errors via `setError("root")`, `<Controller>` for the confidence control, **never `watch()`** (React Compiler + `react-hooks/incompatible-library`) |
| 36 | Field error vs toast | Validation on the block form → field errors. Everything else → the global `MutationCache` toast from `add-feedback-layer`, which means **do not define a local `onError`** on those mutations |
| 37 | Confirm presets | `confirmArchiveDocument` and `confirmDeleteBlock` added **beside** the existing presets in `constants/confirm.ts`, with the copy from `ui.md`. `confirmDelete`'s "permanently deleted" is false for an archive |
| 38 | Generated API types | `pnpm api:types` in `frontend/` with the backend running, **after** the controller is final. `frontend/app/types/api/**` is generated — never hand-edited |
| 39 | Stage-1 count on Overview | `constants/project-stages.ts` stage 1 stops being a constant and reads the real document count. **The other three stay honest zeros** — this change does not invent counts for tables that do not exist |
| 40 | `schema.md` refresh | Part of this change. It records the repo's first composite index created for a query plan, the two new CASCADE edges **with the test that justifies them**, and that the JSON-column question is still open |

### Blast Radius

Resolved against the live tree.

**New — nothing reads these yet**
`backend/src/context/**` · `backend/src/ai/**` ·
`backend/src/database/migrations/<ts>-CreateProjectContext.ts` ·
`frontend/app/projects/[id]/context/page.tsx` · `frontend/components/context/**` ·
`frontend/services/context.ts` · `frontend/hooks/use-context-documents.ts` ·
`use-knowledge.ts` · `use-proposals.ts` · `frontend/types/context.ts`

**Edited — existing code other features depend on**

| File | Change | Risk |
|---|---|---|
| `backend/src/files/files.controller.ts:88` | `download` gains a project-membership check when the file is a context document | **high** — this is a security boundary. A bug here either leaks files or breaks every citation download. It is the one edit that deserves its own tests before and after |
| `backend/src/projects/projects.service.ts:98` | `requireMembership` becomes reachable from `ContextModule` | medium — the gate itself must not change behaviour. Export or relocate; do not reimplement |
| `backend/src/app.module.ts` | registers `ContextModule` and `AiModule` | low |
| `backend/src/config/env.validation.ts` + `.env.example` | four required AI vars | **high blast, low complexity** — every existing `.env` becomes invalid until they are added. The `.env.example` rows and a line in the commit message are what make it survivable |
| `backend/package.json` | `pdf-parse`, `mammoth` | medium — CommonJS compatibility is the whole risk, which is why it is task 1 |
| `frontend/constants/nav.ts` | `Context` row `disabled: true → false` | low — one property; the single-source nav from `add-projects` is untouched |
| `frontend/constants/project-stages.ts` | stage 1 reads a real count | low |
| `frontend/constants/confirm.ts` | two new presets | low |
| `frontend/package.json` | `mermaid` | low — lazy-loaded, no other page touched |
| `frontend/app/types/api/**` | regenerated | low — generated, never hand-edited |
| `devspec/context/schema.md` | refreshed | low |

**Not touched, on purpose**: `backend/test/app.e2e-spec.ts` (the pre-existing failure logged in
`devspec/report/blockers.md`), `FilesService.store` / `.remove`, the `MIME_EXTENSIONS` allowlist,
every other project endpoint, and the `(app)` route group.

### Risk and reversibility

| Area | Risk | Reversible? |
|---|---|---|
| Migration | low | Yes — purely additive, drops three tables in FK order. No existing column touched, no backfill, **no destructive operation anywhere** |
| `GET /files/:id` tightening | **high** | Yes, by reverting one method — but it is a security boundary and a silent failure mode in both directions. Test both: member downloads, non-member 404s, orphan file unchanged |
| AI env vars | high blast | Yes, but every `.env` must be updated once. Same cost `FILE_STORAGE_PATH` imposed |
| Parser dependencies | medium | Yes — swap the library. CommonJS incompatibility is a build-time failure, not a runtime surprise, which is why the spike is first |
| In-process pipeline | medium | Yes — the sweep bounds the damage of a restart. Worst case is a document stuck at `failed` that the user re-runs |
| AI output quality | **the product risk** | n/a — QuoteGuard and schema validation are the mechanical defences; the human accept is the real one |
| Mermaid | low | Yes — lazy-loaded, falls back to source on error |

## Open questions

- **`locator` for DOCX.** `mammoth` yields HTML, from which a heading path is derivable — but only if the source document actually uses heading styles. For a flat document `locator` is null and the `quote` carries the whole verification burden. Acceptable; revisit if real documents make it common.
- **Rejected and superseded blocks accumulate forever.** That is what gives traceability, and nothing prunes them. A prune path is a destructive DB operation and is deliberately not specced — flagged in `db.md` for a human.
- **Cost ceiling per document.** Nothing caps spend on a 500-page upload beyond the 100MB file limit. A character-count ceiling with a "this document is too large to read" failure is the obvious guard; not specced because no real number exists yet. Worth adding the moment a bill surprises someone.
