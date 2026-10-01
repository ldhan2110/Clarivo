# Spec: add-project-context

Behaviour contract. Schema in `db.md`, decisions in `design.md`, screens in `ui.md`.

Throughout: **viewer** is the authenticated user; **member** is a viewer with a `project_members`
row for the project. Every endpoint below is under `/projects/:projectId/...` unless stated.

---

### Requirement: context endpoints are member-scoped [req-1]
The API SHALL restrict every context endpoint to members of the project, and SHALL return 404 to a
non-member rather than 403.

#### Scenario: a member reads the context
- **WHEN** a member requests `GET /projects/:id/documents`
- **THEN** the API returns 200 with that project's documents

#### Scenario: a non-member is told nothing
- **WHEN** a viewer with no membership row requests any context endpoint for that project
- **THEN** the API returns 404 `PROJECT_NOT_FOUND`
- **AND** the response body does not reveal that the project exists

#### Scenario: a member may write, not only read
- **WHEN** a member (not the owner) uploads a document or edits a knowledge block
- **THEN** the API returns success — context work is member-level, not owner-only

---

### Requirement: document upload [req-2]
The API SHALL accept a context document upload, store it through the existing file service, record
it against the project, and return before any processing happens.

#### Scenario: a supported document is accepted
- **WHEN** a member posts a PDF, DOCX, TXT or MD file to `POST /projects/:id/documents`
- **THEN** the API returns 201 with the document, its `status` being `pending`
- **AND** a `files` row and a `project_documents` row both exist
- **AND** the response arrives without waiting for parsing or any AI call

#### Scenario: an unsupported type is refused
- **WHEN** a member uploads a file whose MIME type is not in the existing allowlist
- **THEN** the API returns 400 and no `project_documents` row is created

#### Scenario: the same filename twice
- **WHEN** a member uploads a file with a filename already present in the project
- **THEN** a second, independent document row is created
- **AND** citations on existing blocks still point at the first document

---

### Requirement: text extraction with locators [req-3]
The system SHALL extract plain text from a document as ordered segments, each carrying the most
precise locator its format allows.

#### Scenario: a PDF yields page locators
- **WHEN** a PDF is parsed
- **THEN** each segment carries a locator of the form `p.<n>`

#### Scenario: a markdown file yields heading locators
- **WHEN** a `.md` file containing `#` headings is parsed
- **THEN** each segment carries a locator of the form `§<heading>`

#### Scenario: a plain text file yields line locators
- **WHEN** a `.txt` file is parsed
- **THEN** each segment carries a locator of the form `line <n>`

#### Scenario: a document with no extractable text fails readably
- **WHEN** a scanned PDF containing no text layer is parsed
- **THEN** the document reaches `status: failed`
- **AND** `error` states that no text could be extracted and that the file is still stored
- **AND** the file remains downloadable

---

### Requirement: background processing with observable status [req-4]
The system SHALL process a document in the background and expose its progress as a status, and
SHALL never leave a document non-terminal forever.

#### Scenario: status walks to ready
- **WHEN** a document is uploaded and processing succeeds
- **THEN** its `status` moves through `pending`, `parsing`, `summarizing`, `proposing` to `ready`
- **AND** `GET /projects/:id/documents` reflects the current status on each request

#### Scenario: the page updates without a manual refresh
- **WHEN** a member is on the context page while a document is processing
- **THEN** the documents list refreshes on its own until no document is non-terminal, then stops

#### Scenario: a restart does not strand a document
- **WHEN** the server restarts while a document is `parsing`, and more than 30 minutes have passed
- **THEN** the boot sweep moves that document to `failed` with a readable error
- **AND** the member can re-run it

#### Scenario: other documents are unaffected by one failure
- **WHEN** one document fails
- **THEN** every other document's status and every existing knowledge block are unchanged

---

### Requirement: document summarisation [req-5]
The system SHALL reduce a document's extracted text to a single stored digest, using the cheap
model for the per-segment pass and the strong model for the final pass.

#### Scenario: a long document is summarised in two passes
- **WHEN** a document's extracted text exceeds one segment group
- **THEN** each group is summarised with `AI_MODEL_FAST`
- **AND** those partial summaries are reduced with `AI_MODEL_STRONG` into `project_documents.digest`

#### Scenario: a short document skips the map pass
- **WHEN** a document's extracted text fits in one segment group
- **THEN** only the `AI_MODEL_STRONG` pass runs and the digest is stored

#### Scenario: the raw text is not retained
- **WHEN** summarisation completes
- **THEN** only the digest is persisted; extracted text is not stored in the database

---

### Requirement: proposals, never direct writes [req-6]
The system SHALL express everything it learns from a document as proposals, and SHALL NOT add,
change or remove a knowledge block without a human accepting it.

#### Scenario: a first upload produces proposals, not blocks
- **WHEN** the first document of an empty project finishes processing
- **THEN** its findings exist as blocks with `state: proposed`
- **AND** `GET /projects/:id/knowledge` returns no accepted blocks until a human accepts them

#### Scenario: a later document proposes an update
- **WHEN** a new document restates an existing accepted block with more detail
- **THEN** a proposal of kind `update` is created with `supersedes_id` pointing at that block

#### Scenario: contradicting sources raise a conflict
- **WHEN** a new document contradicts an existing accepted block
- **THEN** a proposal of kind `conflict` is created carrying both statements and both sources
- **AND** the system does not choose between them

#### Scenario: a human-edited block is never silently replaced
- **WHEN** a new document would update a block whose `edited_at` is set
- **THEN** the proposal is recorded as a `conflict`, not an `update`
- **AND** a proposal of kind `update` targeting such a block is rejected by the server

---

### Requirement: fabricated citations are blocked mechanically [req-7]
The API SHALL discard any extracted proposal whose supporting quote does not appear verbatim in
the source document's extracted text.

#### Scenario: an unsupported quote is dropped
- **WHEN** the model returns a proposal whose `quote` is not found in the extracted text after whitespace normalisation
- **THEN** that proposal is not persisted
- **AND** the remaining proposals from the same document are persisted normally

#### Scenario: a supported quote survives
- **WHEN** a proposal's `quote` appears verbatim in the extracted text
- **THEN** the proposal is persisted with that quote and its locator

#### Scenario: derived blocks are exempt by rule, not by omission
- **WHEN** the project brief or a diagram block is generated
- **THEN** no verbatim quote is required, because it is derived from digests and blocks rather than extracted from a span
- **AND** it carries document-level citations with a null locator

#### Scenario: a malformed model response does not half-write
- **WHEN** the model returns a response that fails schema validation twice
- **THEN** the document moves to `failed` with `AI_UNAVAILABLE`
- **AND** no block from that run is persisted

---

### Requirement: proposal review [req-8]
The API SHALL let a member accept or reject each proposal, and SHALL preserve the losing side with
its source.

#### Scenario: accepting an add
- **WHEN** a member accepts a proposal of kind `add`
- **THEN** that block becomes `accepted` and appears on the knowledge page

#### Scenario: accepting an update
- **WHEN** a member accepts a proposal of kind `update`
- **THEN** the proposal becomes `accepted` and its target becomes `superseded`
- **AND** the superseded block remains readable as history

#### Scenario: resolving a conflict three ways
- **WHEN** a member chooses "keep existing" / "use new" / "write my own" on a conflict
- **THEN** respectively: the proposal is `rejected`; the proposal is `accepted` and the target `superseded`; a new human block supersedes the target and the proposal is `rejected`
- **AND** in all three cases both sources remain recorded

#### Scenario: rejecting keeps the record
- **WHEN** a member rejects a proposal
- **THEN** it becomes `rejected`, disappears from the queue, and is not deleted

#### Scenario: a proposal cannot be resolved twice
- **WHEN** a member accepts or rejects a proposal that is no longer `proposed`
- **THEN** the API returns 409 `PROPOSAL_ALREADY_RESOLVED`

---

### Requirement: the knowledge page [req-9]
The API SHALL return the accepted knowledge of a project grouped into nine fixed sections, and the
page SHALL render a section that has no blocks as a gap rather than hiding it.

#### Scenario: sections render in a fixed order
- **WHEN** a member opens the context page of a project with accepted blocks
- **THEN** the sections appear in the order project brief, scope, stakeholders, process, data model, constraints, integrations, glossary, open questions

#### Scenario: an empty section is a signal
- **WHEN** a section has no accepted blocks
- **THEN** its heading still renders, with an "Ask about this" marker explaining that the gap becomes a discovery question

#### Scenario: a block shows its confidence and its sources
- **WHEN** an AI-authored block renders
- **THEN** it shows its confidence as stated, implied or uncertain, and one citation chip per source
- **AND** activating a citation chip downloads that document

#### Scenario: a human block is attributed
- **WHEN** a human-authored block renders
- **THEN** it is marked as written by its author rather than carrying a confidence tag alone

---

### Requirement: human authorship of knowledge [req-10]
The API SHALL let a member add, edit and delete knowledge blocks directly, with or without any
document.

#### Scenario: writing a block on a blank project
- **WHEN** a member adds a block with a section, a statement and a confidence, and no citation
- **THEN** the block is created with `origin: human`, `state: accepted` and no refs

#### Scenario: editing marks ownership
- **WHEN** a member edits a block's statement
- **THEN** `edited_at` is set
- **AND** from then on no document can produce an `update` against it — only a `conflict`

#### Scenario: deleting is not permanent refusal
- **WHEN** a member deletes a block
- **THEN** it no longer appears on the page
- **AND** a later document asserting the same thing may propose it again

---

### Requirement: the project brief [req-11]
The system SHALL maintain one project brief synthesised across every document at once, SHALL
regenerate it only on request, and SHALL show when it is out of date.

#### Scenario: the brief reads the whole corpus
- **WHEN** a member regenerates the brief
- **THEN** its input is every document's digest, the project's own domain, objective and customer BU, and the accepted blocks
- **AND** it may state something no individual block states
- **AND** it cites documents rather than blocks

#### Scenario: regenerating proposes, it does not overwrite
- **WHEN** a member regenerates the brief while one already exists
- **THEN** a proposal of kind `update` targeting the current brief is created
- **AND** the current brief stays on the page until the proposal is accepted

#### Scenario: staleness is stated, not fixed silently
- **WHEN** documents have reached `ready` since the brief was written
- **THEN** the page shows how many, and offers regeneration
- **AND** the brief is not regenerated automatically

#### Scenario: a brief is possible with no documents
- **WHEN** a project has no documents
- **THEN** a brief can still be generated from the project's own fields and any human blocks

---

### Requirement: diagrams [req-12]
The system SHALL render a knowledge block whose statement contains a mermaid fence as a diagram,
and SHALL never render a broken diagram as a blank area.

#### Scenario: a valid diagram renders
- **WHEN** a block's statement contains a ` ```mermaid ` fence with valid syntax
- **THEN** the page renders it as a diagram, with the block's citations below it

#### Scenario: a broken diagram shows its source
- **WHEN** the mermaid in a block fails to render
- **THEN** the source is shown in a monospace panel together with the error
- **AND** the block remains editable

#### Scenario: a diagram is an ordinary block
- **WHEN** a member edits, deletes or supersedes a diagram block
- **THEN** it behaves exactly as any other block — no separate type, no separate flow

---

### Requirement: document download is authorised by membership [req-13]
The API SHALL require project membership to download a file that belongs to a project document,
while leaving files that belong to no project unchanged.

#### Scenario: a member downloads a cited document
- **WHEN** a member requests `GET /files/:id` for a file backing one of that project's documents
- **THEN** the file streams as before

#### Scenario: a non-member is refused
- **WHEN** an authenticated non-member requests that same file by id
- **THEN** the API returns 404 and no bytes are sent

#### Scenario: an unowned file is unaffected
- **WHEN** an authenticated viewer requests a file that has no `project_documents` row
- **THEN** behaviour is exactly as before this change

---

### Requirement: document lifecycle [req-14]
The API SHALL let a member rename, re-read and archive a document, and SHALL NOT provide any way
to delete one.

#### Scenario: re-reading costs no re-parse
- **WHEN** a member re-runs a document that is `ready`
- **THEN** its still-`proposed` blocks are discarded and proposals are regenerated from the stored digest
- **AND** accepted blocks are untouched

#### Scenario: archiving keeps citations resolvable
- **WHEN** a member archives a document
- **THEN** it leaves the active documents list
- **AND** blocks citing it keep their citations, and those citations still download

#### Scenario: there is no delete
- **WHEN** any client attempts to delete a document
- **THEN** no endpoint exists to do so

---

### Requirement: an archived project is read-only [req-15]
The API SHALL reject every context write on an archived project, and the page SHALL present itself
as read-only.

#### Scenario: writes are refused
- **WHEN** a member uploads, edits a block, or resolves a proposal on an archived project
- **THEN** the API returns 409 `PROJECT_ARCHIVED`

#### Scenario: reads and downloads still work
- **WHEN** a member opens the context page of an archived project
- **THEN** the knowledge page and documents render, downloads work, and every write control is absent

---

### Requirement: the AI provider is configuration, not code [req-16]
The system SHALL reach the model through one OpenAI-compatible endpoint configured by environment,
and SHALL refuse to start if that configuration is missing.

#### Scenario: switching provider is a config change
- **WHEN** `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST` and `AI_MODEL_STRONG` are changed
- **THEN** the system calls the new provider with no code change

#### Scenario: a missing variable fails at boot
- **WHEN** any of the four variables is absent
- **THEN** the process fails validation at startup rather than at the first upload

#### Scenario: a provider outage fails one document, not the app
- **WHEN** the provider is unreachable during processing
- **THEN** that document reaches `failed` with `AI_UNAVAILABLE` and a readable error
- **AND** the rest of the application continues to serve

---

### Requirement: context is reachable and counted [req-17]
The application SHALL expose the context page from the project navigation and SHALL show a true
document count on the project overview.

#### Scenario: the nav row is live
- **WHEN** a member views a project
- **THEN** the sidebar's Context row is enabled and routes to `/projects/:id/context`

#### Scenario: stage one shows a real number
- **WHEN** a project has documents
- **THEN** the Overview stage-1 tile shows the real count
- **AND** the remaining three stages still show honest zeros, because their tables do not exist
