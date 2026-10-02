_approved_by: LE AN_
_approved_at: 2026-10-02_

# Proposal: add-project-context

## Why

Clarivo's pipeline is **Context → Discovery plan → Meetings → Requirements**. Stage 1 is the gate:
until a project can absorb what it's about, nothing downstream can be more than a template. The
sidebar's `Context` row is disabled and Overview's stage 1 reads an honest `0 files`.

An earlier build of this change shipped a block-and-citation knowledge page with a per-document
async pipeline and an accept/reject review queue. It was reverted (`DropProjectContext` migration;
`src/context/*` removed) — the shape was heavier and plainer than the product needs. This proposal
**re-specs the change** around a simpler, denser model the BA signed off on.

## What this delivers

A project gains a **Context** page with two source feeders and one output:

**Two feeders.**
- **Documents.** Upload PDF, DOCX, TXT or MD through the existing `FilesService`. Each upload is a
  source row, initially unprocessed.
- **Web research.** Enter a company name (e.g. "SAMBU VINA") or a website URL; Clarivo searches the
  web (Tavily), shows the pages it found, and on confirmation adds them as web source rows. This is
  the "before you visit the customer" intel that pre-fills the basics so discovery meetings don't
  waste time on them.

**One output — a single `summary.md` per project.** Not a list of blocks, not a review queue: one
editable markdown document organised into fixed sections (Overview, Scope, Process, Stakeholders,
Constraints, Integrations, Data model, Glossary, Open questions). Under each section a **Sources**
line cites the documents or URLs it came from. Where two sources disagree, an inline
`⚠ Sources differ` note is written into the section — conflict surfacing without a separate screen.
Diagrams (process flow, system context) are emitted as **```mermaid blocks inside the same file**
and rendered in the page. Thin sections render as an explicit "likely a discovery question" — the
gap signal the discovery stage later reads.

**Process once, for everything.** Instead of a per-document pipeline, uploaded and web sources sit
unprocessed until one **Process all** action reads every source, extracts its text, and generates
the summary in a single background run. The page polls while it runs.

**The human is the author.** AI output is a draft. A BA can **Edit** the markdown directly;
**Regenerate** re-runs the summary, and never silently clobbers a page a human has edited — it warns
first. A blank project still works: with no sources, the page is thin but the project's own domain
and objective are context, and the BA can type the summary by hand.

## Scope — in

| Area | What |
|---|---|
| DB | Two new tables (`project_documents` reshaped, `project_knowledge` new), one additive migration. See `db.md` |
| Backend | A context module: document upload (via `FilesService`), web research (Tavily), process-all, summary read/edit/regenerate |
| Extraction | PDF / DOCX / TXT / MD → text with a best-effort locator; web pages → fetched extract |
| AI | One OpenAI-compatible HTTP client over native `fetch`. Map-reduce summarisation producing one markdown with sections, citations and mermaid diagrams |
| Web search | A Tavily REST client over native `fetch`; company name or URL → pages with extract |
| Async | `status` per source + an in-process background Process-all + a boot-time sweep that fails stuck rows. Frontend polls while any source is non-terminal |
| Security | `GET /files/:id` (`FilesController.download`) tightened: a file backed by a project document requires project membership |
| Frontend | The `/projects/:id/context` page (summary.md render + edit, sources panel, research flow, process-all, mermaid), the `Context` sidebar row enabled, Overview stage 1 reading the real source count |
| Env | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG`, `TAVILY_API_KEY` in `env.validation.ts` + `.env.example` |

## Scope — out

| Not doing | Why |
|---|---|
| RAG, embeddings, vector store | Deliberate: the summary is the only thing downstream reads. No retrieval |
| Block/citation-row model, proposal review queue | The reverted shape. Replaced by one editable markdown with inline source lines |
| A job queue (BullMQ, pg-boss) | Nothing runs a second instance. In-process background + a stuck-row sweep is the honest floor; a `ponytail:` comment names the upgrade |
| An agent framework (LangGraph, Vercel AI SDK, etc.) | Backend is CommonJS; those are ESM-first and fight the build. One fetch client + map-reduce covers it |
| OCR / vision for scanned PDFs or images | A source with no extractable text fails readably; no OCR |
| Discovery plan / meeting scaffold generation | The stage that *reads* this summary. Its own change |
| Document or source hard-delete | A destructive DB op — out of scope, flagged for a human |
| TTS / STT | A later want; no abstraction built for it now |
| Multi-turn research agent | Research here is one search → confirm → fold in. The conversational agent is the discovery change |

## Decisions already settled in discussion

| Question | Decision |
|---|---|
| Knowledge as blocks or one document? | **One `summary.md`** per project, fixed sections, editable |
| Citations | **Inline `Sources:` line** per section (doc name + §locator, or URL). Not a separate table |
| Conflicts | **Inline `⚠ Sources differ` note** in the section. No review screen |
| Diagrams | **```mermaid blocks inside `summary.md`**, rendered client-side. No diagram table |
| Processing | **One "Process all"** over every unprocessed source, background, polled. No per-document pipeline |
| Web research | **Tavily**, company name or URL → draft findings → human confirms → folds in, URL-cited |
| Store web search? | **Store the extracted text only** (`extracted_text`), not raw search results, chunks, or embeddings — so Regenerate needn't re-fetch |
| AI provider | **Switchable by config**, one OpenAI-compatible client |
| Regenerate vs human edits | **Never auto-clobber.** If `edited`, Regenerate warns and requires confirmation |
| Download of a cited document | **Members only** — which forces the `GET /files/:id` tightening |

## Risks

- **Large change.** A migration, a parser, an AI client, a Tavily client, a background pipeline, a
  security tightening, and a dense frontend page. Expect the frontend to land last.
- **AI output quality is the product.** A summary that misattributes a source or invents a citation
  is worse than empty. The map step must use the cheap model; the generated mermaid must be valid or
  it won't render.
- **New required env.** Every `.env` breaks until the AI and Tavily vars are added. Validated at boot
  by rule — no silent fallback.
- **Parser + CommonJS.** `pdf-parse` and `mammoth` are already installed and known-CJS-safe; the
  Tavily call is raw REST over `fetch`, so no new ESM dependency enters the build.
