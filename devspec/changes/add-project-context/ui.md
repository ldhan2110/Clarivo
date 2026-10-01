# UI: add-project-context

**Mockups**: `mockups/context.html` (6 states), `mockups/dialogs.html` (8 states) — approved 2026-10-01 by LE AN.
**References**: no new reference image. Both mockups are siblings of the approved
`devspec/archive/add-projects/mockups/project-detail.html` — same shell, grid, cards, badges and buttons.
**Style source**: tokens copied verbatim from `frontend/app/globals.css` `:root` (`--primary`, `--muted-foreground`,
`--success`, `--warning`, `--destructive`, `--chart-1..3`, `--radius`, the `--sidebar-*` set). In the real build these
are Tailwind v4 semantic utilities (`bg-card`, `text-muted-foreground`, `border-border`) — never raw hex, per
`frontend/CLAUDE.md`.

## Route

One route: `app/projects/[id]/context/page.tsx`, inside the existing `app/projects/layout.tsx`
(the project-scoped shell, not the `(app)` group). The sidebar's Context row flips from
`disabled: true` to `false` in `frontend/constants/nav.ts:projectNavItems`.

The proposal queue is **not** a separate route — it replaces the knowledge region in place, so a
conflict card gets the full column width. State lives in a `?review=<documentId>` search param so
the view is linkable and the browser back button works.

## context — the page

Three regions in the two-column grid the project detail page already uses (`1.55fr / 1fr`):

```
  ┌─ Context ───────────────────── [✎ Add a note] [⬆ Upload documents] ─┐
  │                                                                     │
  │  ┌─ 7 proposals from Kickoff-minutes.docx ──────────── [Review] ─┐  │  ← proposal bar
  │  └───────────────────────────────────────────────────────────────┘  │     (hidden at 0)
  │                                                                     │
  │  ┌─ Project knowledge ────────────┐  ┌─ Documents ──────────────┐   │
  │  │  PROJECT BRIEF    ⟳ Regenerate │  │  🗎 SRS-v2.pdf           │   │
  │  │  ┌───────────────────────────┐ │  │     4.2 MB · 9 blocks    │   │
  │  │  │ What this is. …           │ │  │     [✓ Read] ⬇ ⋯         │   │
  │  │  │ Who it is for. …          │ │  │  🗎 Kickoff-minutes.docx │   │
  │  │  │ What is being built. …    │ │  │     [⟳ Summarizing]      │   │
  │  │  │ What constrains it. …     │ │  │  ───────────────────────  │   │
  │  │  │ What is still unknown. …  │ │  │  ⬆ Add more  [Choose]    │   │
  │  │  │ 🗎a ⬇ 🗎b ⬇ 🗎c ⬇    ✎  │ │  └──────────────────────────┘   │
  │  │  └───────────────────────────┘ │                                 │
  │  │  SCOPE                      4  │                                 │
  │  │  ● Billing stays on SAP…       │                                 │
  │  │    🗎 SRS-v2.pdf p.12 ⬇  stated│                                 │
  │  │  ◐ Invoicing may be phase 2…   │                                 │
  │  │  DATA MODEL                 3  │                                 │
  │  │  ┌ ▦ ER diagram ───────────┐   │                                 │
  │  │  │ Customer 1─<places>─n Order│ │                                │
  │  │  └─────────────────────────┘   │                                 │
  │  │  INTEGRATIONS               0  │                                 │
  │  │  [Ask about this] nothing …    │                                 │
  │  └────────────────────────────────┘                                 │
  └─────────────────────────────────────────────────────────────────────┘
```

**Nine sections, fixed order**: Project brief · Scope · Stakeholders · Process · Data model ·
Constraints · Integrations · Glossary · Open questions. A section with zero blocks still renders
its heading plus an **"Ask about this"** chip — an empty section is a signal, not nothing.

**Project brief** is one block rendered as prose in a tinted panel, not as a bullet. It is
synthesised across **every document at once** (each document's digest + the project's own
`domain` / `objective` / `customerBu` + the accepted blocks), which is why it can state something
no single block does and why it cites documents rather than blocks. Five fixed angles —
*What this is · Who it is for · What is being built · What constrains it · What is still unknown*.
`⟳ Regenerate` proposes a replacement; it never overwrites. When documents have been read since
it was written, a stale ribbon says so by count.

**A block** is: confidence mark (`●` stated / `◐` implied / `?` uncertain, coloured
`--success` / `--warning` / `--muted-foreground`) · markdown statement · a footer of citation
chips (`🗎 SRS-v2.pdf p.12 ⬇`, each one downloads the document) and tags · hover controls `✎ 🗑`.
A human-written block shows `✎ written by <name>` instead of a confidence tag.

**A diagram is a block whose statement contains a ` ```mermaid ` fence** — same edit, supersede
and citation flow, no special type. Mermaid is lazy-loaded; a render failure shows the source in a
monospace panel with the error, never a blank box.

**States**: empty (`mockups/context.html` §1) · processing (§2) · ready with proposals (§3) ·
review open (§4) · a failed document (§5) · archived project, read-only (§6).
Archived hides every write control and keeps downloads working.

**Interactions**: upload returns immediately and the row walks `pending → parsing → summarizing →
proposing → ready | failed`; the list polls while any row is non-terminal and stops when none is.
A citation chip downloads its document. `Review` opens the queue in place.

## review — the proposal queue

Replaces the knowledge region; the documents column becomes a source panel with the counts.
Three card kinds, each with a 3px left rule: **add** (`--success`), **update** (`--chart-2`),
**conflict** (`--warning`).

```
  ┌─ Queue ──────────────────────────────────── 1 of 7 ─┐
  │ ┃ NEW BLOCK  [Stakeholders] [stated]  Reject Accept │
  │ ┃ The warehouse supervisor is the approver for …    │
  │ ┃ │ "…must be signed off by the Binh Duong …"       │
  │ ┃ 🗎 Kickoff-minutes.docx §1 ⬇                      │
  │                                                     │
  │ ┃ UPDATE  [Process]                 Reject  Accept  │
  │ ┃ ┌ was: Dispatch planning appears to be manual ─┐  │  ← struck through
  │ ┃ │              ↓ replaced by                   │  │
  │ ┃ └ now: Dispatch planning is manual — one ops …─┘  │
  │ ┃ confidence implied → stated                       │
  │                                                     │
  │ ┃ ⚠ CONFLICT  [Constraints]                         │
  │ ┃ ┌ on the page now ─┐ VS ┌ proposed ──────────┐    │
  │ ┃ │ Go-live is Q1 …  │    │ Go-live moved to … │    │
  │ ┃ │ "…per annex B"   │    │ "…ERP freeze"      │    │
  │ ┃ └──────────────────┘    └────────────────────┘    │
  │ ┃   [Keep existing] [Write my own] [Use new]        │
  └─────────────────────────────────────────────────────┘
```

Every proposal shows the **verbatim quote** it came from. Clarivo never resolves a conflict on its
own; whichever side loses is recorded as rejected *with its source*, so the disagreement survives
as something to raise in a meeting. `Accept all 4 new` is offered for the add-only subset — there
is no "accept all" across updates or conflicts.

## dialogs

All eight in `mockups/dialogs.html`.

- **Upload** — idle dropzone / queued with an unsupported file rejected in the browser before it reaches the server / in flight with per-file progress and a "reading runs in the background" close.
- **Add block** — section `<select>`, markdown statement, confidence segmented control with each level's meaning spelled out, optional citations. Lands accepted, marked as written by the author.
- **Edit block** — same form plus a citation editor (document · locator · quote). Carries the warning that **saving marks the block as human-edited, after which no document can silently replace it** — a later disagreement raises a conflict instead.
- **Edit diagram** — the same editor; the statement is simply mermaid, shown in a monospace field with a live preview.
- **Document menu** — download original · rename · read again · archive.
- **Archive document confirm** — says plainly that the blocks stay and keep citing it, and that an archived document is still downloadable so every citation still resolves.
- **Delete block confirm** — says that a later document asserting the same thing will propose it again; deleting is not a permanent "no".
- **Toasts** — read complete / proposals accepted / read failed.

## Components

Reuse, resolved against the repo — the worker builds from these, not from fresh plain elements:

| Need | Reuse |
|---|---|
| Dialogs (upload, add block, edit block) | `components/ui/dialog.tsx` |
| Destructive confirms (archive document, delete block) | the confirm provider from `add-feedback-layer` via `hooks/use-confirm.ts` — **not** a hand-rolled `alert-dialog` |
| Toasts | `sonner` through the existing provider; never a bespoke notification |
| Buttons | `components/ui/button.tsx` — `variant` default / outline / ghost / destructive, `size` sm |
| Text fields | `components/ui/input.tsx`; statement + quote fields `components/ui/textarea.tsx` |
| Field labels | `components/ui/label.tsx` |
| Cards, section panels | `components/ui/card.tsx` |
| Status + confidence chips, section counts | `components/ui/badge.tsx` |
| Document row menu | `components/ui/dropdown-menu.tsx` |
| Processing placeholders | `components/ui/skeleton.tsx` |
| Hover hints on icon-only controls | `components/ui/tooltip.tsx` |
| Dividers | `components/ui/separator.tsx` |
| Toast/confirm tone icons | `components/ui/tone-icon.tsx` |

**There is no `select.tsx` in this repo** and the shadcn CLI hangs here (`devspec/context/rules.md`).
The section picker is a **native `<select>` styled with the same classes as `input.tsx`** — nine
options do not justify hand-copying a Radix Select. Mark it with a `// ponytail:` comment naming
the upgrade path.

**There is no progress primitive.** The upload bar is a two-div track, styled with
`bg-secondary` / `bg-primary` — not a new component.

Forms follow `frontend/CLAUDE.md`: react-hook-form + `zodResolver`, schema beside the form,
messages in the schema, server errors to `setError("root")`, busy = `isSubmitting ||
mutation.isPending`, `<Controller>` for the confidence control, and **never `watch()`**.

## Also changed outside this page

- `frontend/constants/nav.ts` — the project `Context` row becomes enabled.
- `frontend/constants/project-stages.ts` — stage 1's `count` / `detail` / `soon` stop being constants and read the real document count. **The other three stages stay honest zeros**; this change does not invent counts for tables that still do not exist.

## Verify

`Verify: /devspec-verify add-project-context` — agent-browser against the running app
(frontend :3001, API :3000), using the seeded accounts in `devspec/improve/testing.md`:
regions present, styling not browser-default, the nine section headings render in order, an empty
section shows its "Ask about this" chip, a document row reaches `ready` from `pending` without a
manual refresh, a citation chip downloads, a proposal accept moves a block onto the page, and the
archived project renders every write control absent.
