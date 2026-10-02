# UI: add-project-context (Context page)

**Mockup**: `mockups/context.html` (approved 2026-10-02 by LE AN) — 5 states stacked.
**References**: product board `assets/ChatGPT Image Sep 30, 2026, 02_57_53 PM.png` screens 4 & 5 (richer, dashboard-dense direction the BA asked for — A+D). Supersedes the dropped build's plain two-column look.
**Style source**: tokens from `frontend/app/globals.css` (OKLCH CSS variables — `--primary` `#3A75FD`, `--foreground` navy `#16213D`, `--secondary`, `--border`, `--warning`, `--destructive`, `--success`, sidebar tokens, `--radius` 0.625rem). shadcn/ui style `new-york`, baseColor slate (`frontend/components.json`). Use semantic tokens only — never raw hex.

> This supersedes the dropped `add-project-context` UI. The knowledge model changed from a block/proposal/review-queue to **one editable `summary.md`**; a second feeder (web research) and **diagrams** were added. Capture should re-spec, not amend the old shape.

## Scope of the UI

One route: `app/(app)/projects/[id]/context/page.tsx`. The sidebar `Context` nav row becomes enabled (was `disabled: true`). No other screen in this change — it's one page with five states.

## Context page

Layout (two-column, dashboard-dense):
```
 Projects › Overview › Context
 ┌───────────────────────────────────────────────────────────────┐
 │ Context  [3 docs · web]        [🔍 Research customer][✎ Edit][↻ Regenerate] │
 │ One summary of everything Clarivo found — documents and the web.│
 ├───────────────────────────────────────────────────────────────┤
 │ [Sources 4] [Sections 7/9] [Diagrams 2] [Coverage ◴ 78%]       │  metric tiles
 ├──────────────────────────────────────────┬────────────────────┤
 │ summary.md (one file, editable)           │ Sources            │
 │  ## Overview        🌐 sambuvina.com      │  Documents · 3     │
 │  ## Scope           SRS-v2.md §Scope      │   📄 SRS-v2.md  ✓  │
 │  ## Process Flow    [ mermaid diagram ]   │   📄 ...        ✓  │
 │  ## Stakeholders    ...                    │  Web · 1           │
 │  ## Constraints  ⚠ sources differ         │   🌐 Sambu Vina ✓  │
 │  ## Integrations  (thin — ask in meeting) │  [+ docs][🔍 web]  │
 └──────────────────────────────────────────┴────────────────────┘
```

### Knowledge = one `summary.md`
- Single markdown document per project: `##` sections (Overview, Scope, Process Flow, Stakeholders, Constraints, Integrations, Data model, Glossary, Open questions — the 9).
- Prose/lists per section. Under each, a **Sources** line: `SRS-v2.md §Scope` for docs, `🌐 sambuvina.com` for web (URL-cited).
- **Conflicts** surface inline as a `⚠ Sources differ: …` note inside the section — no separate review screen.
- **Thin sections** render italic muted ("Thin — likely a discovery question") — the gap signal the discovery stage later reads.
- `[✎ Edit]` flips the rendered md to a raw-markdown textarea (edit the file directly); save re-renders. `[↻ Regenerate]` re-runs the summary from all processed sources (overwrites AI content; human edits are the open question — see design).

### Diagrams
- Rendered from **```mermaid fenced blocks inside `summary.md`** — a diagram is just part of the one file, nothing separate.
- AI emits them when the content supports it: **process flow** (from process docs), **system context** (integrations). Mockup shows a hand-drawn stand-in; real app renders with **mermaid** (new frontend dep — flag in design/db).
- `[✎ Edit]` exposes the mermaid source in the textarea like any other md.

### Web research (second feeder)
- `[🔍 Research customer]` → a form: **Company name** (e.g. "SAMBU VINA") OR **Company website** URL, + optional "what are they building".
- Runs **Tavily** web search → a **draft findings** view (sections + the pages read, URL-listed) → `[＋ Add to summary]` folds it in, or `[✕ Discard]`. Findings are cited by URL and editable afterward.
- A web source appears in the Sources panel under **Web**, alongside Documents.

### Documents + Process-all
- Upload many files; each shows `new` until processed. **No per-document pipeline.**
- **One `[⚡ Process all (n)]`** button (header + Sources panel) processes every unprocessed source — docs and web — in one background run.
- Processing is one global state: "Summarizing n sources… / Drawing process-flow diagram". Page is leaveable; poll for completion.

## States (all in the mockup)
- **Filled** — summary.md with sections, a rendered diagram, web + doc citations, Sources split docs/web.
- **Research customer** — the name/URL form.
- **Research results** — draft findings + pages read, confirm before folding in.
- **Uploaded, not processed** — sources tagged `new`, one `[Process all]`, empty summary with a prompt.
- **Processing** — one global progress, sources flip `new → read`.
- **Failed source** — a doc that yields no text fails readably ("scanned image, OCR unsupported"); the rest still summarize. (Shown as the error treatment in the docs panel.)

## Components
Frontend was reverted — **no `components/ui/` in the tree today**. Add shadcn/ui (`new-york`, slate) **by hand** (the CLI hangs — per `conventions.md`, copy source into `app/components/ui/` and `pnpm add` any radix dep):
- `Button` (`app/components/ui/button.tsx`) — header actions, Process all, Accept.
- `Card` — knowledge panel, Sources panel, tiles.
- `Input` / `Label` — research form.
- `Badge` — status tags (`new`/`processed`/`failed`), the `pill` counts.
- `Progress` — the global processing bar.
- App shell / sidebar — the `Context` nav row lives in `app/(app)/layout.tsx`; enable it (was disabled).
- **mermaid** — new dep for diagram rendering; render ```mermaid blocks client-side. No other CDN.

**Verify** (for capture's tasks `Verify:` lines): `/devspec-verify add-project-context` — agent-browser drives the running app (dev :3001, API :3000): Context page regions exist (tiles, summary, Sources), `[Process all]` present and not per-row, a rendered diagram node is visible (not raw ```mermaid text), research form opens, styling is tokened (not browser-default). Optional `MANUAL: BA approves screenshot` visual gate.
