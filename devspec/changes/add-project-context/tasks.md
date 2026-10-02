# Tasks: add-project-context

## 0. Spike — LangChain loads under CommonJS [req-5][req-2]
- [x] 0.1 [backend] `pnpm add langchain @langchain/core @langchain/openai @langchain/tavily` in `backend/` — plus `@langchain/textsplitters` (v1 moved splitters to their own package)
- [x] 0.2 [backend] Smoke test `src/context/langchain-load.spec.ts`: import `ChatOpenAI`, `TavilySearch`, `RecursiveCharacterTextSplitter`, instantiate each (no network), assert no load/resolve error under `"type":"commonjs"` + `module:nodenext`. 3/3 pass
- [x] 0.3 [backend] Build stayed clean (`pnpm build` ok) — no ESM-only break, no fallback needed
Verify: `cd backend && pnpm build && pnpm test langchain-load`

## 1. Env + config [req-11]
- [x] 1.1 [backend] `TAVILY_API_KEY` added to `EnvironmentVariables` (`src/config/env.validation.ts`, `@IsString()`+`@IsNotEmpty()`); AI_* already present (survived the revert)
- [x] 1.2 [backend] `TAVILY_API_KEY` added to `backend/.env.example` (AI_* rows already there); placeholder added to the gitignored `.env` so boot works
- [x] 1.3 [test] `src/config/env.validation.spec.ts`: base fixture gains `TAVILY_API_KEY`, new case asserts boot fails naming it — 10/10 pass
Verify: `cd backend && pnpm test env.validation`

## 2. Schema — entities + migration [req-1][req-3][req-4][req-5]
- [x] 2.1 [db] `ProjectDocument` entity (`src/context/project-document.entity.ts`) — all columns, CHECKs (source_type, status, doc-XOR-web), `@Index(project_id)`, CASCADE project / RESTRICT file+uploader, explicit snake_case `name:`
- [x] 2.2 [db] `ProjectKnowledge` entity (`src/context/project-knowledge.entity.ts`) — UNIQUE project_id, summary_md default '', edited default false, generated_at nullable, CASCADE project
- [x] 2.3 [db] Generated `1790916308501-CreateProjectKnowledge.ts` — additive (2 CREATE TABLE + FKs; DROPs only in down()); runs + reverts clean on the dev DB
- [x] 2.4 [test] `project-document.entity.spec.ts` + `project-knowledge.entity.spec.ts` — snake_case, nullability, CHECKs, UNIQUE asserted; 15/15 context tests pass
Verify: `cd backend && pnpm test context && pnpm migration:run && pnpm migration:revert` (applies and reverts clean on the dev DB)

## 3. Extraction — parsers [req-4][req-9]
- [x] 3.1 [service] `DocumentParser` (`src/context/document-parser.ts`): mime dispatch — `pdf-parse` v2 (`new PDFParse({data}).getText()`) for PDF, `mammoth.extractRawText` for DOCX, UTF-8 for TXT/MD → `{ text, locator }`
- [x] 3.2 [service] Empty extraction throws `CONTEXT_UNREADABLE_SOURCE`, unsupported mime throws `CONTEXT_UNSUPPORTED_TYPE` (`src/context/context.errors.ts`, `defineErrors('CONTEXT', …)`)
- [x] 3.3 [test] `src/context/document-parser.spec.ts`: TXT + MD extract; empty → UNREADABLE; unsupported → UNSUPPORTED. 4/4 pass
Verify: `cd backend && pnpm test document-parser`

## 4. AI client — summarise [req-5]
- [x] 4.1 [service] `AiClient` (`src/context/ai-client.ts`): two `ChatOpenAI` instances (FAST/STRONG) from `ConfigService`, `configuration.baseURL`=AI_BASE_URL, apiKey=AI_API_KEY
- [x] 4.2 [service] `summarise(input)`: `RecursiveCharacterTextSplitter` → FAST map per segment → STRONG reduce into the 9 fixed `##` sections, per-section `Sources:` line, `⚠ Sources differ` note, ```mermaid blocks; single short source skips the map; `StringOutputParser` on each chain
- [x] 4.3 [service] `// ponytail:` comment on the background-run / job-queue ceiling
- [x] 4.4 [test] `src/context/ai-client.spec.ts`: ChatOpenAI mocked — STRONG reduces, FAST maps a large source, reduce runs last, malformed mermaid passes through. 3/3 pass
Verify: `cd backend && pnpm test ai-client`

## 5. Web research — Tavily [req-2]
- [x] 5.1 [service] `WebResearch` (`src/context/web-research.ts`): wraps `TavilySearch` (`includeRawContent`, maxResults 5); `search({companyName|url, building?})` → `{ findings_md, pages:[{title,url,extract}] }`
- [x] 5.2 [service] Zero results → `{ findings_md: '', pages: [] }` (no throw)
- [x] 5.3 [test] `src/context/web-research.spec.ts`: TavilySearch mocked — query built from name+building, url-only path, hits→pages, empty result. 4/4 pass
Verify: `cd backend && pnpm test web-research`

## 6. Context service — process-all, regenerate, sweep [req-4][req-5][req-8][req-9]
- [x] 6.1 [service] `ContextService` — `processAll` (checks `new` count, fires `runPipeline` background, returns `{started}`); `runPipeline` parses doc / uses web extract, sets status+processed_at, a failure → `failed`+reason and continues, then `AiClient.summarise` → upsert `project_knowledge`
- [x] 6.2 [service] `regenerate(projectId, viewerId, force)` — throws `CONTEXT_SUMMARY_EDITED` if `edited && !force`; else regenerates, resets `edited=false`
- [x] 6.3 [service] `editSummary` — upsert summary_md, set `edited=true`
- [x] 6.4 [service] `onModuleInit` sweep — `processing` → `failed`; `// ponytail:` boot-sweep-not-a-queue note
- [x] 6.5 [service] `getContext` — `ContextView`: summary, sources (no extracted_text), `coverage` from non-thin `##` headings / 9, `processing` flag
- [x] 6.6 [test] `src/context/context.service.spec.ts`: in-memory repos + real parser — new→processed + summary; failed source doesn't abort; edited not clobbered; regenerate blocks/forces. 5/5 pass
Verify: `cd backend && pnpm test context.service`

## 7. Context controller + DTOs [req-1][req-2][req-3][req-6][req-7][req-8]
- [x] 7.1 [backend] DTOs (`src/context/dto/`): request `ResearchRequestDto`/`AcceptResearchDto`/`UpdateSummaryDto`/`RegenerateDto` (class-validator); response `ContextDto`/`SourceDto`/`ResearchDraftDto` with `@Expose()` — `extracted_text` never exposed
- [x] 7.2 [backend] `ContextController` (`@Controller('projects/:id')`): POST documents (multipart→doc, 201), POST research (draft, 200), POST research/accept (web sources, 201), POST context/process (202/200), GET context, PUT context/summary, POST context/regenerate, GET documents (poll)
- [x] 7.3 [backend] `JwtAuthGuard` on the controller; every service method calls `ProjectsService.requireProject` (membership gate) → non-member 404/403
- [x] 7.4 [backend] `ContextModule` (forFeature ProjectDocument/ProjectKnowledge/Project + FilesModule + ProjectsModule), registered in `app.module.ts`; `CONTEXT` errors in `context.errors.ts`; build clean
- [x] 7.5 [test] `context.controller.spec.ts`: upload→doc, research draft (no persist), accept→web, regenerate CONTEXT_SUMMARY_EDITED, GET context drops extracted_text, process 202/200. 6/6 pass
Verify: `cd backend && pnpm test context.controller`

## 8. Download authorisation [req-10]
- [x] 8.1 [backend] `FilesController.download` tightened: a file backing a `project_documents(source_type='doc')` row requires `ProjectsService.requireMembership`; a file with no document keeps prior behaviour; web sources have no file_id. FilesModule gains ProjectsModule + ProjectDocument forFeature (no Files↔Context cycle)
- [x] 8.2 [test] `src/files/files.controller.spec.ts` (new): member downloads; non-member refused (requireMembership throws `PROJECT_NOT_FOUND` — the repo's deliberate 404 non-leaking pattern, not 403; more secure, so used over the spec's "403" shorthand); no-document file unchanged. 3/3 pass; full suite 172/172
Verify: `cd backend && pnpm test files.controller`

## 9. Frontend — Context page [req-12]
- [ ] 9.1 [frontend] Add shadcn primitives by hand into `app/components/ui/` (CLI hangs — per conventions): `button`, `card`, `input`, `label`, `badge`, `progress`. Install any radix dep with pnpm
- [ ] 9.2 [frontend] `app/lib/context-api.ts` (through the shared `app/lib/api.ts` axios) + TanStack Query hooks (`app/hooks/use-context.ts`): get context, list sources (poll via `refetchInterval` while any source non-terminal), upload, research, accept, process-all, edit, regenerate
- [ ] 9.3 [frontend] `app/(app)/projects/[id]/context/page.tsx` — build to `mockups/context.html`: metric tiles, two-column summary + Sources panel (Documents/Web split), header actions (Research / Edit / Regenerate / Process all), states empty/unprocessed/processing/failed. Semantic tokens only, no raw hex
- [ ] 9.4 [frontend] Render `summary_md` as markdown with ```mermaid blocks via the `mermaid` dep (`pnpm add mermaid`); `[Edit]` swaps to a raw-markdown `<textarea>`; `[Regenerate]` on an edited summary shows a confirm that resends `force:true`
- [ ] 9.5 [frontend] Research flow: a dialog/section with company-name OR url + optional "building" input → draft findings + pages list → "Add to summary" posts accept
- [ ] 9.6 [frontend] After a backend API change, rerun `pnpm api:types` (backend up) so `app/types/api/` matches
Verify: `/devspec-verify add-project-context` (agent-browser on :3001/:3000 — tiles + summary + Sources regions exist, a rendered mermaid node is visible (not raw ```mermaid text), one "Process all" action (not per-row), research dialog opens, styling tokened not browser-default)

## 10. Frontend — sidebar + overview count [req-12]
- [ ] 10.1 [frontend] Enable the `Context` sidebar row in `app/(app)/layout.tsx` (was `disabled: true`) → links to `/projects/:id/context`
- [ ] 10.2 [frontend] Overview stage 1 reads the real source count from `GET /projects/:id/documents` instead of the `0 files` constant; the other three stages stay honest zeros
Verify: `/devspec-verify add-project-context` (Context nav row navigates; Overview stage 1 shows a real count)
