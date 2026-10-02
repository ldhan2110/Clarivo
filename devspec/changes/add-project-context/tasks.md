# Tasks: add-project-context

Run top-to-bottom; each section depends only on the ones above it.
Backend gate is `pnpm test`. **Never run `pnpm test:e2e`** — `backend/test/app.e2e-spec.ts` is the
pre-existing failure logged in `devspec/report/blockers.md`.

---

## 1. Dependencies, env contract and the AI client [req-16]
The parser spike is first on purpose: the backend is CommonJS and an ESM-only library breaks the
build outright, which is cheaper to discover now than in section 3.

- [x] 1.1 [backend] Spike: `cd backend && pnpm add pdf-parse mammoth`, then prove both load under CommonJS with a throwaway `node -e "require('pdf-parse');require('mammoth')"`. If either fails, swap `pdf-parse` for `pdfjs-dist`'s legacy CJS build and record the swap in `design.md` Decision Default 14
- [x] 1.2 [backend] Add `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG` to `backend/src/config/env.validation.ts` as `@IsString() @IsNotEmpty()` — required, no code default (per `devspec/context/rules.md`)
- [x] 1.3 [backend] Add the four rows to `backend/.env.example` with placeholder values and a comment naming OpenRouter as the reference provider. **Never commit a real key**
- [x] 1.4 [backend] New `backend/src/ai/ai.client.ts` — `AiClient.complete({ model, system, user, schema })` over native `fetch` against `AI_BASE_URL + '/chat/completions'`. Returns parsed JSON validated against the passed DTO class with `class-validator`; retries once on a malformed response, then throws
- [x] 1.5 [backend] New `backend/src/ai/ai.errors.ts` — `defineErrors('AI', { UNAVAILABLE: 502 })`, mirroring `files.errors.ts`
- [x] 1.6 [backend] New `backend/src/ai/ai.module.ts` exporting `AiClient`; register it in `backend/src/app.module.ts`
- [x] 1.7 [test] `backend/src/ai/ai.client.spec.ts` — a stubbed `fetch` returning valid JSON resolves; malformed JSON retries once then throws `AI_UNAVAILABLE`; a non-200 throws `AI_UNAVAILABLE`

Verify: `cd backend && pnpm test -- src/ai && pnpm build`

## 2. Entities and the migration [req-2] [req-9]
Fourth migration this repo has run. Purely additive — three new tables, no existing column touched.
Columns, types, FKs, CHECKs and indexes are specified in `db.md`; follow it exactly.

- [x] 2.1 [db] New `backend/src/context/project-document.entity.ts` — `@Entity('project_documents')` extending `BaseEntity`. Every `@Column` carries an explicit `name:` (no naming strategy is configured — a forgotten `name:` ships camelCase). FK `project_id` CASCADE, `file_id` RESTRICT + unique, `uploaded_by` RESTRICT. `@Check` on `status`
- [x] 2.2 [db] New `backend/src/context/knowledge-block.entity.ts` — `@Entity('knowledge_blocks')`, the self-FK `supersedes_id` RESTRICT, `@Check` on `section` (nine values), `confidence`, `origin`, `state`, `kind`, plus the cross-column CHECK `(kind='add') = (supersedes_id IS NULL)`, and `@Index(['projectId','state'])`
- [x] 2.3 [db] New `backend/src/context/knowledge-ref.entity.ts` — `@Entity('knowledge_refs')`, `block_id` CASCADE + `@Index()`, `document_id` RESTRICT + `@Index()`
- [x] 2.4 [db] Generate the migration: `cd backend && pnpm build && pnpm migration:generate src/database/migrations/CreateProjectContext`. **Read the generated SQL before running it** — confirm three `CREATE TABLE`s and no `ALTER` against an existing table
- [x] 2.5 [db] `pnpm migration:run`, then `pnpm migration:revert`, then `pnpm migration:run` again — proving it reverts clean in FK order
- [x] 2.6 [test] `backend/src/context/*.entity.spec.ts` for each entity, copying the pattern in `backend/src/files/file.entity.spec.ts`: assert the table name and every column's snake_case `name`, nullability and CHECK values

Verify: `cd backend && pnpm test -- src/context && docker exec clarivo-postgres-1 psql -U clarivo -d clarivo -c '\d project_documents' -c '\d knowledge_blocks' -c '\d knowledge_refs'`

## 3. The document parser [req-3]
- [x] 3.1 [service] New `backend/src/context/parser/document-parser.ts` — `extract(path, mimeType): Promise<Segment[]>` where `Segment = { text: string; locator: string | null }`. Dispatches on mime type
- [x] 3.2 [service] `parser/pdf.parser.ts` — `pdf-parse`, one segment per page, `locator = 'p.<n>'`
- [x] 3.3 [service] `parser/docx.parser.ts` — `mammoth.convertToHtml`, segment on `<h1>`–`<h3>`, `locator = '§<heading>'`; null locator when the document uses no heading styles
- [x] 3.4 [service] `parser/text.parser.ts` — `.md` segments on `#` headings (`§<heading>`), `.txt` on blank-line paragraphs (`line <n>`)
- [x] 3.5 [service] Throw `CONTEXT_UNSUPPORTED_DOCUMENT` when extraction yields no non-whitespace text, with the message from `ui.md` state 5 ("No text could be extracted — this looks like a scanned image…")
- [x] 3.6 [test] `backend/src/context/parser/document-parser.spec.ts` with small fixtures under `src/context/parser/__fixtures__/`: a 2-page PDF → 2 segments with `p.1`/`p.2`; a markdown file → heading locators; an empty-text PDF → `UNSUPPORTED_DOCUMENT`

Verify: `cd backend && pnpm test -- src/context/parser`

## 4. Context module: access, upload and listing [req-1] [req-2]
- [x] 4.1 [backend] Make `requireMembership` reachable from the new module — export it from `ProjectsService` (`backend/src/projects/projects.service.ts:98`) or lift it into a `ProjectAccess` provider both modules inject. **Do not reimplement the gate**; its 404-for-non-member / 403-for-non-owner behaviour must not change
- [x] 4.2 [backend] New `backend/src/context/context.errors.ts` — `defineErrors('CONTEXT', …)` with `DOCUMENT_NOT_FOUND` 404, `BLOCK_NOT_FOUND` 404, `UNSUPPORTED_DOCUMENT` 400, `DOCUMENT_NOT_READY` 409, `PROPOSAL_ALREADY_RESOLVED` 409, `DOCUMENT_ARCHIVED` 409
- [x] 4.3 [backend] New `backend/src/context/dto/` — `ProjectDocumentDto` (id, title, originalName, mimeType, sizeBytes, status, error, blockCount, createdAt; `@Expose()` only these — never `storageKey`), `UploadDocumentDto` (empty, so the global `ValidationPipe` rejects stray form fields, copying `UploadFileDto`)
- [x] 4.4 [backend] New `backend/src/context/context.service.ts` — `uploadDocument(projectId, file, viewerId)`: `requireMembership` → `FilesService.store` → insert `project_documents` with `status: 'pending'` → return. `listDocuments(projectId, viewerId)` returns active documents newest-first with a per-document accepted-block count
- [x] 4.5 [backend] New `backend/src/context/context.controller.ts` — `POST /projects/:projectId/documents` (`@UseGuards(JwtAuthGuard)`, `UploadErrorInterceptor` + `FileInterceptor('file')`, reusing the multer config already registered in `FilesModule`) and `GET /projects/:projectId/documents`
- [x] 4.6 [backend] New `backend/src/context/context.module.ts` — `TypeOrmModule.forFeature([ProjectDocument, KnowledgeBlock, KnowledgeRef])` (**the only thing that registers these entities**), importing `FilesModule`, `ProjectsModule` and `AiModule`; register it in `app.module.ts`
- [x] 4.7 [test] `backend/src/context/context.service.spec.ts` — a member uploads and gets a `pending` row; a non-member gets `PROJECT_NOT_FOUND`; the same filename twice yields two rows; an unsupported mime type is refused

Verify: `cd backend && pnpm test -- src/context/context.service.spec.ts`

## 5. The background pipeline and summarisation [req-4] [req-5]
- [x] 5.1 [service] New `backend/src/context/context.pipeline.ts` — `run(documentId)` driving `parsing → summarizing → proposing → ready|failed`, writing `status` and `error` at each step, with an in-process concurrency cap of 2. Mark the ceiling: `// ponytail: in-process, single instance. pg-boss when a second instance exists.`
- [x] 5.2 [service] Map/reduce in the pipeline: group segments to ~6000 characters without splitting a segment; summarise each group with `AI_MODEL_FAST`; reduce the partials with `AI_MODEL_STRONG` into `project_documents.digest`. A single group skips the map pass. Do **not** persist extracted text
- [x] 5.3 [backend] Fire-and-forget from the controller after the 201 (`void this.pipeline.run(id)`), so the upload response never waits on a model call
- [x] 5.4 [service] `OnModuleInit` sweep in `ContextService`: any document non-terminal for more than 30 minutes becomes `failed` with a readable error
- [x] 5.5 [test] `backend/src/context/context.pipeline.spec.ts` with a stubbed `AiClient` — status reaches `ready` and a digest is stored; a one-group document calls the fast model zero times; a parser throw lands `failed` with the message; a failure leaves other documents and all existing blocks untouched
- [x] 5.6 [test] Sweep test: a row stuck at `parsing` with an old `updated_at` is failed on init; a fresh one is left alone

Verify: `cd backend && pnpm test -- src/context/context.pipeline.spec.ts`

## 6. Proposal generation and the quote guard [req-6] [req-7]
- [x] 6.1 [service] New `backend/src/context/proposal-generator.ts` — input is the digest plus the project's accepted blocks (id, section, statement, `edited_at`); output is a validated array of `{ kind, section, statement, confidence, supersedesId?, quote, locator }` from `AI_MODEL_STRONG`
- [x] 6.2 [service] The prompt must exclude human-edited blocks from the update path and state that a disagreement with one is a `conflict`. Enforce it server-side too: an `update` targeting a block with `edited_at` set is converted to `conflict` before persisting
- [x] 6.3 [service] New `backend/src/context/quote-guard.ts` — drop any proposal whose `quote` does not appear verbatim in the document's extracted text after whitespace normalisation. Count and log the drops; never fail the document for them
- [x] 6.4 [service] Persist survivors as `knowledge_blocks` with `state: 'proposed'`, `origin: 'ai'`, `source_document_id`, plus one `knowledge_refs` row per citation. A schema-validation failure after one retry fails the document with `AI_UNAVAILABLE` and persists **nothing** from that run
- [x] 6.5 [test] `backend/src/context/quote-guard.spec.ts` — a fabricated quote is dropped while its siblings survive; a quote differing only in whitespace survives
- [x] 6.6 [test] `backend/src/context/proposal-generator.spec.ts` with a stubbed `AiClient` — an update targeting an edited block is stored as `conflict`; a malformed response twice persists no rows and fails the document

Verify: `cd backend && pnpm test -- src/context/quote-guard.spec.ts src/context/proposal-generator.spec.ts`

## 7. Proposal review endpoints [req-8]
- [x] 7.1 [backend] `GET /projects/:projectId/knowledge/proposals` — `state='proposed'`, grouped by `source_document_id`, each carrying its target block when `supersedes_id` is set
- [x] 7.2 [backend] `POST /projects/:projectId/knowledge/proposals/:blockId/accept` — `add` → `accepted`; `update` → `accepted` + target `superseded`; `conflict` → body `{ resolution: 'keep_existing' | 'use_new' | 'write_own', statement? }` applying the three outcomes from `design.md` Default 23. All state changes in one transaction
- [x] 7.3 [backend] `POST /projects/:projectId/knowledge/proposals/:blockId/reject` — `rejected`, never deleted
- [x] 7.4 [backend] Resolving a block that is not `proposed` returns 409 `PROPOSAL_ALREADY_RESOLVED`
- [x] 7.5 [test] `backend/src/context/proposals.service.spec.ts` — each accept path lands the right two states; `write_own` creates a human block superseding the target and rejects the proposal; double-resolve is a 409; a rejected proposal's row and refs still exist

Verify: `cd backend && pnpm test -- src/context/proposals.service.spec.ts`

## 8. Knowledge read and human authorship [req-9] [req-10]
- [x] 8.1 [backend] `GET /projects/:projectId/knowledge` — accepted blocks with their refs, grouped into the nine sections **in the fixed order**, each ref carrying `documentId`, `title`, `locator` and `fileId` so the UI can link a download
- [x] 8.2 [backend] `POST /projects/:projectId/knowledge/blocks` — `CreateBlockDto` (section, statement, confidence, optional refs). Creates `origin: 'human'`, `state: 'accepted'`, `kind: 'add'`
- [x] 8.3 [backend] `PATCH /projects/:projectId/knowledge/blocks/:id` — updates statement/confidence/refs and **sets `edited_at`**
- [x] 8.4 [backend] `DELETE /projects/:projectId/knowledge/blocks/:id` — removes the block from the page. This is the one hard delete in the change and it is a row the user created; documents are never deleted
- [x] 8.5 [test] `backend/src/context/knowledge.service.spec.ts` — sections come back in the fixed order including empty ones; a human block needs no refs; editing sets `edited_at`; a non-member gets 404 on every one of these

Verify: `cd backend && pnpm test -- src/context/knowledge.service.spec.ts`

## 9. The project brief [req-11]
- [x] 9.1 [service] New `backend/src/context/brief-generator.ts` — input is **every** `project_documents.digest`, the project's `domain` / `objective` / `customerBu`, and the accepted blocks; output is one statement covering the five fixed angles from `ui.md` (what this is / who it is for / what is being built / what constrains it / what is still unknown), using `AI_MODEL_STRONG`
- [x] 9.2 [backend] `POST /projects/:projectId/knowledge/brief/regenerate` — creates an `overview` block; `kind: 'update'` with `supersedes_id` when a brief exists, `kind: 'add'` when none does; always `state: 'proposed'`
- [x] 9.3 [service] The brief is **exempt from QuoteGuard** by rule (it is derived, not extracted). It gets one document-level ref per document read, with a null locator
- [x] 9.4 [backend] Return `briefStaleCount` on `GET …/knowledge` — documents that reached `ready` after the current brief's `created_at`. No auto-regeneration anywhere
- [x] 9.5 [test] `backend/src/context/brief-generator.spec.ts` — the generator receives every digest plus the project fields; regenerating with an existing brief produces a proposed update and leaves the live brief in place; a project with no documents still produces a brief; `briefStaleCount` counts only documents newer than the brief

Verify: `cd backend && pnpm test -- src/context/brief-generator.spec.ts`

## 10. Document lifecycle [req-14]
- [x] 10.1 [backend] `PATCH /projects/:projectId/documents/:id` — rename (`title` only)
- [x] 10.2 [backend] `POST /projects/:projectId/documents/:id/reread` — discard that document's still-`proposed` blocks, re-run the proposal step **from the stored digest** (no re-parse, no map cost), leave accepted blocks untouched
- [x] 10.3 [backend] `POST /projects/:projectId/documents/:id/archive` — sets the document aside; its blocks and refs are untouched and remain downloadable. Idempotent
- [x] 10.4 [backend] **No delete endpoint exists.** Deleting a document would strand the citations that make the page checkable
- [x] 10.5 [test] `backend/src/context/document-lifecycle.spec.ts` — re-read drops proposed and keeps accepted, and never calls the parser; archive leaves blocks and refs intact; the archived document is absent from the list and still resolvable by id

Verify: `cd backend && pnpm test -- src/context/document-lifecycle.spec.ts`

## 11. Archived projects are read-only [req-15]
- [x] 11.1 [backend] A shared `assertProjectWritable` in `ContextService`, applied to every write (upload, block create/edit/delete, proposal accept/reject, brief regenerate, document rename/reread/archive) — 409 `PROJECT_ARCHIVED`, reusing the existing `ProjectErrors.ARCHIVED`
- [x] 11.2 [backend] Reads and `GET /files/:id` are untouched on an archived project
- [x] 11.3 [test] `backend/src/context/archived-project.spec.ts` — a table-driven test asserting 409 on every write endpoint and 200 on every read

Verify: `cd backend && pnpm test -- src/context/archived-project.spec.ts`

## 12. Download authorisation [req-13]
**The one security boundary in this change.** A bug here either leaks files or breaks every
citation download — write the tests first.

- [x] 12.1 [test] Write `backend/src/files/download-authorisation.spec.ts` **before** the change: a member downloads a context file; a non-member gets 404; a file with no `project_documents` row behaves exactly as today
- [x] 12.2 [backend] In `FilesController.download` (`backend/src/files/files.controller.ts:88`), after `files.findById`, look up `project_documents` by `file_id`. No row → unchanged behaviour. A row → `requireMembership(projectId, viewerId)`, which throws 404 for a non-member
- [x] 12.3 [backend] Keep this as the single download path — do **not** add a project-scoped duplicate route serving the same bytes
- [x] 12.4 [backend] Delete the now-false "any authenticated user can download any file" note wherever `add-file-storage` recorded it as accepted, and replace it with what is now true

Verify: `cd backend && pnpm test -- src/files && pnpm test`

## 13. Frontend data layer [req-9] [req-8]
- [x] 13.1 [frontend] `cd frontend && pnpm api:types` with the backend running, **after** the controller is final. `frontend/app/types/api/**` is generated — never hand-edited
- [x] 13.2 [frontend] New `frontend/services/context.ts` — one function per endpoint, returning unwrapped `data`, typed from `@/types/api`. No React, no toasts
- [x] 13.3 [frontend] New `frontend/hooks/use-context-documents.ts` — list query with `refetchInterval` **only while a document is non-terminal**, upload/rename/reread/archive mutations. Keys `['context', projectId, 'documents']`
- [x] 13.4 [frontend] New `frontend/hooks/use-knowledge.ts` — knowledge query plus block create/edit/delete and brief regenerate. Key `['context', projectId, 'knowledge']`
- [x] 13.5 [frontend] New `frontend/hooks/use-proposals.ts` — proposals query, accept/reject mutations invalidating both knowledge and proposals. Key `['context', projectId, 'proposals']`
- [x] 13.6 [frontend] Define **no local `onError`** on these mutations — the global `MutationCache` toast from `add-feedback-layer` handles them (a local handler stands the toast down)

Verify: `cd frontend && npx tsc --noEmit && npx eslint services/context.ts hooks/use-context-documents.ts hooks/use-knowledge.ts hooks/use-proposals.ts`

## 14. The context page [req-9]
Build to `mockups/context.html` states 1, 2, 3, 5 and 6. Reuse the components named in `ui.md`.

- [x] 14.1 [frontend] New `frontend/app/projects/[id]/context/page.tsx` inside the existing `app/projects/layout.tsx` shell. Two-column grid `1.55fr / 1fr`, matching `app/projects/[id]/page.tsx`
- [x] 14.2 [frontend] New `components/context/documents-card.tsx` — document rows with status chips, the four-pip progress, `⬇`, and a `⋯` menu built from `components/ui/dropdown-menu.tsx`. Reuse `components/ui/card.tsx` and `badge.tsx` — NOT new elements
- [x] 14.3 [frontend] New `components/context/knowledge-page.tsx` — nine sections in the fixed order; an empty section renders its heading plus the "Ask about this" chip from `ui.md`
- [x] 14.4 [frontend] New `components/context/knowledge-block.tsx` — confidence mark (`--success` / `--warning` / `--muted-foreground`), statement, citation chips that download via the file id, hover `✎ 🗑` controls, human attribution. Semantic tokens only (`bg-card`, `text-muted-foreground`) — no raw hex
- [x] 14.5 [frontend] New `components/context/project-brief.tsx` — the tinted prose panel, `⟳ Regenerate`, and the stale ribbon driven by `briefStaleCount`
- [x] 14.6 [frontend] New `components/context/context-empty.tsx` — state 1, following the existing `components/projects/project-empty.tsx` pattern
- [x] 14.7 [frontend] Loading uses `components/ui/skeleton.tsx`; the archived project renders the read-only ribbon and omits every write control

Verify: `/devspec-verify add-project-context` (agent-browser: the nine section headings render in order, an empty section shows its chip, a document row reaches `ready` from `pending` with no manual refresh, a citation chip downloads, styling is not browser-default)

## 15. Diagram rendering [req-12]
- [x] 15.1 [frontend] `cd frontend && pnpm add mermaid`
- [x] 15.2 [frontend] New `components/context/diagram-block.tsx` — `next/dynamic` with `ssr: false` so a page with no diagram loads nothing. Detect a ` ```mermaid ` fence in the statement with a regex; render everything else as plain text
- [x] 15.3 [frontend] A render error shows the source in a monospace panel with the message — **never a blank box** (`mockups/context.html` state 5)
- [x] 15.4 [frontend] A diagram block keeps every ordinary block control: edit, delete, citations, supersede

Verify: `/devspec-verify add-project-context` (agent-browser: a valid mermaid block renders an `<svg>`; a deliberately broken one renders its source, not an empty element)

## 16. Proposal review UI [req-8]
Build to `mockups/context.html` state 4.

- [x] 16.1 [frontend] The proposal bar above the knowledge page, hidden at zero proposals, with the per-document count
- [x] 16.2 [frontend] New `components/context/proposal-queue.tsx` — replaces the knowledge region in place, driven by a `?review=<documentId>` search param so the view is linkable and back works
- [x] 16.3 [frontend] New `components/context/proposal-card.tsx` — three kinds with their left rules: `add` (quote shown), `update` (old struck through → new), `conflict` (side-by-side with three actions). Reuse `components/ui/button.tsx` variants, never bespoke buttons
- [x] 16.4 [frontend] "Accept all" offered **only** for the add-only subset; never across updates or conflicts
- [x] 16.5 [frontend] The source panel replaces the documents card while reviewing, showing the counts from `mockups/context.html` state 4

Verify: `/devspec-verify add-project-context` (agent-browser: accepting a proposal moves a block onto the knowledge page and drops the queue count; a conflict card shows both sources and three actions)

## 17. Dialogs [req-10]
Build to `mockups/dialogs.html`, all eight states.

- [x] 17.1 [frontend] New `components/context/upload-dialog.tsx` using `components/ui/dialog.tsx` — idle dropzone, queued list with unsupported types filtered **in the browser before upload**, per-file progress, and a close that leaves processing running
- [x] 17.2 [frontend] New `components/context/block-form-dialog.tsx` — one dialog for add and edit. `react-hook-form` + `zodResolver`, schema beside the form, `z.infer` for the type, `<Controller>` for the confidence control, **never `watch()`**
- [x] 17.3 [frontend] Section picker is a **native `<select>` styled with `input.tsx`'s classes** — there is no `select.tsx` and the shadcn CLI hangs here (`devspec/context/rules.md`). Add a `// ponytail:` comment naming the upgrade
- [x] 17.4 [frontend] The citation editor: document select, locator input, quote textarea (`components/ui/textarea.tsx`), add/remove rows
- [x] 17.5 [frontend] The edit dialog carries the warning from `ui.md`: saving marks the block as human-edited and no document can silently replace it afterwards
- [x] 17.6 [frontend] Add `confirmArchiveDocument` and `confirmDeleteBlock` **beside** the existing presets in `constants/confirm.ts`, with the copy from `ui.md`. Route both through `hooks/use-confirm.ts` — do not hand-roll an alert dialog, and do not reuse `confirmDelete` (its "permanently deleted" is false for an archive)
- [x] 17.7 [frontend] Diagram editing uses the same dialog with a monospace statement field and a live preview

Verify: `/devspec-verify add-project-context` (agent-browser: the upload dialog filters an unsupported file client-side; adding a block by hand lands it on the page attributed to the author; the archive confirm appears through the shared provider)

## 18. Reachability, counts and documentation [req-17]
- [x] 18.1 [frontend] `frontend/constants/nav.ts` — the project `Context` row becomes `disabled: false`. One property; leave the single-source nav from `add-projects` otherwise untouched
- [x] 18.2 [frontend] `frontend/constants/project-stages.ts` — stage 1's `count` / `detail` / `soon` read the real document count. **Leave the other three stages as honest zeros**
- [x] 18.3 [frontend] `cd frontend && pnpm api:types` once more if the controller changed after task 13.1
- [x] 18.4 [db] Refresh `devspec/context/schema.md`: the three new tables, the repo's **first composite index created for a query plan**, the two new CASCADE edges **with the test that justifies them** (no external bytes, no meaning without the parent) so the next change does not read them as blanket permission, and a note that the JSON-column question is still open
- [ ] 18.5 [backend] Add the four `AI_*` variables to the commit message body — every existing `.env` is invalid until they are set

Verify: `cd backend && pnpm lint && pnpm test && pnpm build && cd ../frontend && npx tsc --noEmit && npx eslint . && pnpm build`
