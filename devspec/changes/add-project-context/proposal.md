_approved_by: LE AN_
_approved_at: 2026-10-01_

# Proposal: add-project-context

## Why

Clarivo's pipeline is **Context → Discovery plan → Meetings → Requirements**. Stage 1 does not
exist. A project today holds a name, a code, a customer BU, a domain, an objective and a member
list — and then the trail stops. The sidebar's `Context` row is `disabled: true`, and
`PROJECT_STAGES[0]` is a frontend constant reading an honest `0 files`.

Everything downstream needs to know what the project is *about*, not just what it is called. A
discovery plan that cannot read the customer's SRS can only ask generic questions. So stage 1 is
the gate: until a project can absorb its documents, nothing after it can be more than a template.

## The architectural commitment: no RAG

Context documents are **summarised once, into a knowledge page, and the raw bytes never enter a
prompt again**. There is no vector store, no embeddings, no retrieval at query time.

This is a deliberate trade and it is what shapes the whole change:

- With retrieval, a summary is a convenience — a downstream feature that needs detail goes back to the chunks.
- Without it, **the knowledge page is the only thing downstream ever reads.** If a fact is not on the page, it does not exist to the discovery planner, the meeting scaffolder or the requirements drafter.

Two consequences stop being polish and become structural:

1. **A human must be able to edit the page.** AI output is a draft; the BA is the author.
2. **Every statement must cite its source.** A summary is lossy, so a reader needs a one-click path to page 12 of the SRS to check it. That is what makes the page trustworthy enough to build on.

"No RAG" means no embeddings and no similarity search. It does **not** mean no chunking — a
300-page PDF still exceeds any context window, so extraction is a map-reduce over headings and
pages. That is a compression problem, not a retrieval one.

## What this delivers

A project gains a **Context** section with two faces:

**Documents.** Upload PDF, DOCX, TXT or MD. Each upload becomes a document row that is parsed,
summarised and then proposes knowledge. Processing is asynchronous — the upload returns
immediately and the row walks `pending → parsing → summarizing → proposing → ready`, or `failed`
with a readable reason. Every document is downloadable by any project member.

**The knowledge page.** One merged page per project, organised into seven fixed sections (scope,
stakeholders, process, constraints, integrations, glossary, open questions). The page is a list
of **blocks** — one assertion each, carrying a confidence (`stated` / `implied` / `uncertain`),
an origin (`ai` / `human`) and its citations back to the documents that support it. A member can
edit any block, add a block by hand, or delete one.

**AI never writes the page — it proposes.** Each document's summary is reconciled against the
blocks already on the page, producing proposals of three kinds: *add* a new block, *update* an
existing one, or *flag a conflict* between two sources. Proposals land in a review queue. A human
accepts or rejects each one; an accepted update supersedes its target, leaving a chain that
records what changed and which document caused it. **A block a human has edited is never
auto-superseded.** Auto-accept does not exist in this change.

This is what makes the second, fifth and tenth upload safe. It also turns conflict detection —
already on the product board — into a first-class feature instead of a merge nuisance: two
documents that disagree produce one conflict proposal showing both quotes side by side.

**A blank project still works.** With no documents, the page is thin rather than empty: the
project's own `domain`, `objective` and `customer_bu` are context, and a member can type blocks
directly. That is also the honest answer to "what needs asking" — with no context, everything
needs asking.

## Scope — in

| Area | What |
|---|---|
| DB | Three new tables (`project_documents`, `knowledge_blocks`, `knowledge_refs`), one additive migration. See `db.md` |
| Backend | A context module: document upload (through the existing `FilesService`), listing, archive, download; knowledge block CRUD; the proposal review endpoints |
| Extraction | PDF / DOCX / TXT / MD → plain text with a locator (page, heading or line) per segment |
| AI | An OpenAI-compatible HTTP client over native `fetch`. Map-reduce summarisation, then a propose step that emits schema-validated blocks |
| Async | `status` column + in-process background pipeline + a boot-time sweep that fails stuck rows. Frontend polls while any document is non-terminal |
| Security | `GET /files/:id` tightened: a file backed by a project document requires project membership |
| Frontend | The `/projects/:id/context` page (documents list + knowledge page + proposal review), the `Context` sidebar row enabled, stage 1 of Overview reading real counts |
| Env | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG` in `env.validation.ts` and `.env.example` |

## Scope — out

| Not doing | Why |
|---|---|
| RAG, embeddings, vector store | The explicit architectural choice above |
| A job queue (BullMQ, pg-boss) | Nothing runs a second instance. In-process background work plus a stuck-row sweep is the honest floor; the ceiling gets a `ponytail:` comment naming the upgrade |
| Auto-accepting proposals | Default off, and no toggle. A page that mutates itself is a page nobody trusts |
| Discovery plan / meeting scaffold generation | This change is the foundation they read. They are their own changes |
| Image context (PNG/JPEG upload is already allowed by the allowlist) | No OCR, no vision call. An uploaded image stores and downloads but produces no knowledge |
| Pruning rejected or superseded blocks | That is a destructive DB operation. It is flagged in `db.md` for a human, deliberately not specced |
| Document delete | Documents archive. A hard delete would strand citations |
| TTS / STT | Named as a later want. Building the abstraction for it now would be an interface with one implementation |
| Per-block comments or threads | Not asked for |
| Project-level RBAC beyond owner/member | `add-projects` settled the model; this change reuses it unchanged |

## Decisions already settled in discussion

| Question | Decision |
|---|---|
| Per-document summary pages, or one merged page? | **One merged page.** Per-document digests exist only as the intermediate the propose step reads — they are not a screen |
| Page format AI and humans can both review | **Block document.** Markdown inside a block, stable block ids outside it. AI returns a JSON array of blocks; a human sees a normal document |
| Citations as a table or JSONB? | **Own table** (`knowledge_refs`). Needed for "which blocks cite this document", the download authorisation join, and orphan detection |
| Synchronous or background? | **Background**, with a polled status |
| Can members download a cited document? | **Yes** — which is what forces the `GET /files/:id` tightening |
| AI provider | **Switchable by config**, one OpenAI-compatible client. OpenRouter / Omniroute / direct all speak it |
| Re-uploading the same filename | **A new document row; both coexist.** Old citations stay valid. No supersede chain at the document level |
| Section taxonomy | **Seven**, `varchar` + CHECK. Empty sections are themselves a signal — "nothing known about integrations" is a question to ask |
| Human-authored blocks with no document | **Allowed.** The blank-project path needs them |
| Locator granularity | **Whatever the parser can honestly report** — page for PDF, heading for DOCX/MD, line for TXT. Null when it can report nothing |
| Re-upload merge strategy | **Staged proposals, human accepts.** Never auto-mutate a page a human has edited |

## Risks

- **This change is large.** Nine or ten task sections spanning a migration, a parser, an AI client, a background pipeline, a security fix and three UI regions. Captured as one change by decision; a reviewer should expect the frontend sections to land last and the proposal-review UI to be the most intricate part.
- **AI output quality is the product.** A propose step that mis-classifies sections or invents citations makes the page worse than empty. The schema validation and the `quote` field are the defences: a block whose quote is not found verbatim in the source text is rejected before it is stored.
- **The AI env vars are required**, so every existing `.env` breaks until they are added. Recommended, not yet settled — see `db.md`'s open questions.
- **Parser dependencies are new and unverified.** The backend is CommonJS; an ESM-only parser breaks the build outright. A spike confirming the chosen PDF and DOCX parsers load under CommonJS is the first task, not an afterthought.
- **Token cost is real.** A 300-page document costs money to summarise. The fast/strong model split exists for this; the map step must use the cheap model.
