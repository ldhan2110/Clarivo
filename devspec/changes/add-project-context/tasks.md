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
- [x] 9.1 [frontend] shadcn primitives already present at `components/ui/` (my ui.md wrongly said absent — they're at the frontend root, not `app/`): button, card, input, label, badge, textarea, dialog, skeleton reused. No `progress` primitive → spinner/div per mockup (ponytail). `mermaid` added
- [x] 9.2 [frontend] `services/context.ts` (via `lib/api`) + `hooks/use-context.ts` (`useProjectContext`/`useSources` poll via `refetchInterval` while non-terminal, upload/research/accept/process/edit/regenerate mutations)
- [x] 9.3 [frontend] `app/(app)/projects/[id]/context/page.tsx` to the mockup: metric tiles (Sources/Sections/Diagrams/Coverage ring), two-col summary + Sources panel (Documents/Web split), header actions, empty/processing/failed states. Semantic tokens only
- [x] 9.4 [frontend] `components/context/summary-view.tsx`: minimal markdown render + lazy `mermaid` for ```mermaid fences (fallback shows source, never blank); `[Edit]` → raw-markdown `<textarea>`; `[Regenerate]` on edited shows a `useConfirm` that resends `force:true`
- [x] 9.5 [frontend] `components/context/research-dialog.tsx`: react-hook-form + zod (name OR url, +building) → draft findings + pages list → "Add to summary" posts accept
- [x] 9.6 [frontend] `pnpm api:types` regenerated (backend live); service/hooks switched to the generated `@/types/api` DTOs; interim `types/context.ts` removed
Verify: `/devspec-verify add-project-context` — **compile-verified (tsc + eslint + build all clean; backend boots live with all 7 context routes; api:types matches). LIVE agent-browser run BLOCKED: needs the frontend dev server + real AI_API_KEY/TAVILY_API_KEY to exercise process→summary→mermaid and research (current keys are `change-me` placeholders, which render the page but fail the AI path). See blockers.md.**

## 10. Frontend — sidebar + overview count [req-12]
- [x] 10.1 [frontend] Added the `Context` row to `projectNavItems` (`constants/nav.ts`, group Plan, enabled, `${base}/context`) — it wasn't present at all, so added rather than un-disabled
- [x] 10.2 [frontend] Overview (`app/(app)/projects/[id]/page.tsx`) calls `projectStages(sources?.length ?? 0)` via `useSources`; the other three stages stay honest zeros
Verify: `/devspec-verify add-project-context` — compile-verified (tsc/eslint/build clean). LIVE nav-navigation + count assertions need the running frontend; folded into the §9 blocker.
