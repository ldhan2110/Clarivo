# Verify fixes: add-project-context  (app vs mockup)

Run 2026-10-01, `agent-browser` against the running app (frontend :3001, API :3000),
signed in as `admin@clarivo.local` from `devspec/improve/testing.md`.

## context — PASS

No mismatches. Evidence in this folder:
`context-empty.png` · `context-ready.png` · `review-queue.png` · `context-populated.png` ·
`context-with-brief.png` · `context-archived.png` · `upload-dialog.png`.

### Mockup diff (computed styles, app ↔ `mockups/context.html`)

| element | property | mockup | app | verdict |
|---|---|---|---|---|
| two-column grid | `grid-template-columns` | `568.938px 367.062px` | `568.938px 367.062px` | identical |
| card | `background-color` | `oklch(1 0 0)` | `lab(100 0 0)` (same white) | match |
| card | `border-radius` / `border-width` | `14px` / `1px` | `14px` / `1px` | identical |
| primary button | `background-color` | `oklch(0.6016 0.2123 263.59)` | `lab(51.44 18.28 -74.79)` — both `--primary` (#3A75FD) | match |
| primary button | `border-radius` / `height` | `10px` / `34px` | `8px` / `32px` | **accepted** — the app uses `components/ui/button.tsx` `size="sm"`; the mockup hand-styled an approximation, and `ui.md` names the component as the reuse target. Component wins over pixel-matching a mockup's stand-in |
| citation chip | `border-radius` / `font-size` | `7px` / `11px` | pill / `12px` | **accepted** — same reason: the app uses `components/ui/badge.tsx` |
| section picker | tag / `height` / `border` / `radius` | — | `SELECT`, 9 options, `36px`, `1px`, `8px` | styled to `input.tsx`, not browser-default, as `ui.md` specifies |

No element is `0`-size, off-canvas or overlapping; `scrollWidth - clientWidth = 0` (no horizontal overflow).

### Behaviour walked in the browser

- Nine sections render in the fixed order; the eight empty ones each show the **Ask about this** chip.
- A document uploaded through the API walked `pending → … → ready` and the list refreshed **without a manual reload** (`refetchInterval` stops once nothing is non-terminal).
- **QuoteGuard dropped the fabricated proposal**: the stub provider returned 5, one carrying an invented quote; 4 were persisted.
- Proposal bar → `Review` → queue opens in place at `?review=<documentId>` (linkable, back works). Each card shows its verbatim quote and a citation chip.
- `Accept` moved a block onto the page; `Accept all 4 new` cleared the queue. Section counts updated.
- A ` ```mermaid ` block rendered a real `<svg>` (`[data-testid=diagram-svg] svg` → 1).
- `Regenerate` proposed a brief with all five angles and **left the live page untouched** until accepted; its citation is document-level with a null locator.
- Human block added by hand lands `accepted`, attributed **written by An Le**.
- Delete-block and archive-document confirms come through the shared confirm provider with their own copy, not `confirmDelete`'s.
- Upload dialog rejected `malware.exe` **in the browser** before any request; `notes.md` queued.
- Archived project: ribbon shown, **zero** write controls (no upload / add note / edit / delete / document menu / regenerate), and 5 citation chips still downloadable. The API agrees independently — `409 PROJECT_ARCHIVED` on a write, `200` on a read.

### Download authorisation (the security boundary) — checked live

| caller | file | result |
|---|---|---|
| member of the owning project | context document | `200` |
| anonymous | context document | `401` |
| authenticated non-member | context document | **`404`** (never 403) |
| authenticated non-member | orphan file with no `project_documents` row | `200` — unchanged, the tightening is not retroactive |

## Pagination

No pager on this screen — the knowledge page is grouped by section and the documents card is a
full list. Nothing to walk.
