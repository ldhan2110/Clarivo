# Spec: add-project-context

### Requirement: document upload creates a source [req-1]
The API SHALL accept a document upload for a project and record it as an unprocessed source.

#### Scenario: a member uploads a PDF
- **WHEN** a project member POSTs a PDF to `/projects/:id/documents`
- **THEN** the file is stored via `FilesService` and a `project_documents` row is created with `source_type='doc'`, `file_id` set, `url` null, `status='new'`
- **AND** the response returns the source with its `status`, not its extracted text

#### Scenario: an unsupported type is rejected
- **WHEN** the upload's mime type is not PDF, DOCX, TXT or MD
- **THEN** the API returns 400 and no source row is created

### Requirement: web research returns draft findings [req-2]
The API SHALL search the web for a named company or URL and return draft findings without persisting them.

#### Scenario: search by company name
- **WHEN** a member POSTs `{ companyName: "SAMBU VINA" }` to `/projects/:id/research`
- **THEN** the API calls Tavily, returns `{ findings_md, pages: [{title, url}] }`, and creates no source row yet

#### Scenario: neither name nor url
- **WHEN** the body has neither `companyName` nor `url`
- **THEN** the API returns 400

#### Scenario: nothing found
- **WHEN** Tavily returns no results
- **THEN** the API returns 200 with `{ findings_md: "", pages: [] }`

### Requirement: accepting research creates web sources [req-3]
The API SHALL persist confirmed research findings as web source rows.

#### Scenario: confirm findings
- **WHEN** a member POSTs the accepted findings to `/projects/:id/research/accept`
- **THEN** one or more `project_documents` rows are created with `source_type='web'`, `url` set, `file_id` null, `extracted_text` set to the fetched extract, `status='new'`

### Requirement: process all unprocessed sources [req-4]
The API SHALL process every unprocessed source of a project in one background run.

#### Scenario: process starts and is async
- **WHEN** a member POSTs `/projects/:id/context/process` with sources in `status='new'`
- **THEN** the API returns 202 immediately and the run proceeds in the background
- **AND** each source moves `new → processing → processed`, with `extracted_text` and `processed_at` set on success

#### Scenario: nothing to process
- **WHEN** no source is in `status='new'`
- **THEN** the API returns 200 and starts no run

### Requirement: summary generation [req-5]
The API SHALL generate one markdown summary per project from the processed sources.

#### Scenario: summary written after processing
- **WHEN** the Process-all run finishes with at least one processed source
- **THEN** a `project_knowledge` row for the project holds `summary_md` containing `##` sections, a `Sources:` line per section, and (where content supports it) at least one ```mermaid block
- **AND** `generated_at` is set

#### Scenario: conflicting sources
- **WHEN** two processed sources state contradictory facts for one section
- **THEN** the section includes an inline `⚠ Sources differ` note naming both

### Requirement: read the context [req-6]
The API SHALL return the current summary, its sources, and coverage.

#### Scenario: read a populated project
- **WHEN** a member GETs `/projects/:id/context`
- **THEN** the response is `{ summary_md, edited, generated_at, status, coverage: {covered, total}, sources: [...] }`
- **AND** no `extracted_text` appears in any source

### Requirement: edit the summary [req-7]
The API SHALL let a member edit the summary markdown directly.

#### Scenario: a member edits
- **WHEN** a member PUTs `{ summary_md }` to `/projects/:id/context/summary`
- **THEN** the row's `summary_md` is replaced and `edited` is set true

### Requirement: regenerate never clobbers a human edit [req-8]
The API SHALL re-generate the summary, but SHALL NOT overwrite a human-edited summary without explicit confirmation.

#### Scenario: regenerate an AI-only summary
- **WHEN** a member POSTs `/projects/:id/context/regenerate` and `edited` is false
- **THEN** the summary is regenerated

#### Scenario: regenerate a human-edited summary without force
- **WHEN** `edited` is true and the body omits `force`
- **THEN** the API returns a `CONTEXT_SUMMARY_EDITED` error and the summary is unchanged

#### Scenario: regenerate with force
- **WHEN** `edited` is true and the body is `{ force: true }`
- **THEN** the summary is regenerated and `edited` resets to false

### Requirement: a source that yields no text fails readably [req-9]
The API SHALL mark an unreadable source failed with a reason and continue processing the rest.

#### Scenario: a scanned PDF
- **WHEN** Process-all hits a PDF with no extractable text
- **THEN** that source becomes `status='failed'` with a human-readable `failure_reason`
- **AND** the run still processes the other sources and generates a summary from them

### Requirement: download requires membership [req-10]
The API SHALL allow downloading a document-backed file only to members of its project.

#### Scenario: a member downloads
- **WHEN** a project member GETs `/files/:id` for a file backing one of that project's documents
- **THEN** the file is returned

#### Scenario: a non-member is refused
- **WHEN** a non-member GETs the same `/files/:id`
- **THEN** the API returns 403

#### Scenario: a file with no document is unchanged
- **WHEN** the file id backs no `project_documents` row
- **THEN** the existing download behaviour is unchanged

### Requirement: AI and search env validated at boot [req-11]
The API SHALL validate the AI and Tavily configuration at startup.

#### Scenario: missing var
- **WHEN** the process starts without `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG` or `TAVILY_API_KEY`
- **THEN** boot fails with a validation error naming the missing var

### Requirement: Context page [req-12]
The frontend SHALL present the context page: a rendered summary, the sources panel, the research flow, and Process-all — matching the approved mockup.

#### Scenario: populated project
- **WHEN** a member opens `/projects/:id/context` for a project with a summary
- **THEN** the page renders the summary markdown with sections and mermaid diagrams, metric tiles, and the Sources panel split into Documents and Web
- **AND** the sidebar `Context` row is enabled and Overview stage 1 shows the real source count

#### Scenario: unprocessed project
- **WHEN** sources are uploaded but unprocessed
- **THEN** the page shows a single "Process all" action and polls until the background run completes

#### Scenario: research flow
- **WHEN** the member runs "Research customer" with a name or URL
- **THEN** the page shows draft findings and the pages found, and "Add to summary" persists them
