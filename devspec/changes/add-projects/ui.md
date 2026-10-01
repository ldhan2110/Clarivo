# UI: add-projects

**Mockups** (approved 2026-10-01 by LE AN):
- `mockups/projects-list.html` — the list, 6 states
- `mockups/project-create-modal.html` — create, 9 states
- `mockups/project-detail.html` — overview + the sidebar scope switch, 6 states
- `mockups/project-settings.html` — settings, 5 states
- `mockups/dashboard.html` — the dashboard after this change, 3 states

**References**: `assets/ChatGPT Image Sep 30, 2026, 02_57_53 PM.png`, screens 2 (Dashboard),
3 (Create Project), 5 (Project Overview). Deliberate departures from the reference are listed
under *Cut from the reference* at the bottom.

**Style source**: every colour, radius and shadow in the mockups is copied from
`frontend/app/globals.css` (`--primary`, `--sidebar`, `--success`, `--warning`, `--chart-1/2/3`,
`--radius`). The sidebar's floating-card shape (18px radius, 264px / 72px widths, `my-3 ml-3`)
comes from `components/sidebar/app-sidebar.tsx`; the nav row's active treatment (left bar +
`bg-sidebar-primary/12`) and the disabled `Soon` badge come from `components/sidebar/nav-item.tsx`;
the error card and stat tiles mirror `app/(app)/page.tsx`.

**Frontend conventions**: `@/*` resolves from the frontend root per `frontend/CLAUDE.md`
(`devspec/context/conventions.md` is stale on this point). Tailwind v4 + shadcn/ui new-york.
**The shadcn CLI hangs in this environment** (`devspec/context/rules.md`) — any new primitive is
hand-copied into `components/ui/`.

---

## Components to reuse

Resolved against the real tree. A subtask that adds UI builds from these, never a fresh plain element.

| Need | Reuse |
|---|---|
| Buttons | `components/ui/button.tsx:Button` — `variant` primary/outline/ghost, `size` sm/icon-sm |
| Cards | `components/ui/card.tsx` — `Card`, `CardHeader`, `CardTitle`, `CardContent` |
| Text inputs | `components/ui/input.tsx:Input` |
| Field labels | `components/ui/label.tsx:Label` |
| Status / role pills | `components/ui/badge.tsx:Badge` — `variant="outline"` for the neutral pill |
| Avatars | `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback` |
| Loading | `components/ui/skeleton.tsx:Skeleton` |
| Row action menu | `components/ui/dropdown-menu.tsx` |
| Dividers | `components/ui/separator.tsx:Separator` |
| Collapsed-rail tooltips | `components/ui/tooltip.tsx` |
| **All** confirms (archive, restore, remove member) | `hooks/use-confirm.ts:useConfirm` → `components/provider/confirm-provider.tsx`. **Imperative — no local dialog state, no new JSX.** |
| Confirm tone icon | `components/ui/tone-icon.tsx:ToneIcon` |
| Success / error toasts | `sonner`'s `toast`, already wired in `app/layout.tsx` |
| Mutation error toasts | Already automatic via the `MutationCache` in `components/provider/query-provider.tsx`. **Defining a local `onError` overrides it** — see that change's design note. |
| Nav rows, both desktop and mobile | `components/sidebar/nav-item.tsx:NavItem` |
| Mobile drawer | `components/sidebar/mobile-nav.tsx` |

### Primitives that do NOT exist yet
`components/ui/` has **no** `dialog`, `table`, or `textarea`. All three are needed:

- **`dialog.tsx`** — the create modal. `alert-dialog.tsx` is not a substitute: it has no close
  button, blocks outside-click dismissal by design, and is owned by the confirm provider.
- **`table.tsx`** — the projects list.
- **`textarea.tsx`** — the Objective field.

Hand-copy each from shadcn/ui new-york (the CLI hangs). **Transcription error is the most likely
defect in those three files** — `tsc` + `eslint` + actually rendering each one is the check.

---

## Navigation model

The one structural change: the sidebar has **two scopes**. Outside a project it is global; inside
`/projects/:id/*` it swaps to that project's sections. `components/sidebar/nav-groups.tsx` and
`components/sidebar/mobile-nav.tsx` both render from one source today (`constants/nav.ts:NAV_ITEMS`)
so they cannot drift — **keep that property**: two arrays, one scope-picking function, both
renderers still reading one source.

```
GLOBAL SCOPE                       PROJECT SCOPE  — inside /projects/:id
  Workspace                          ← All projects          (back row)
    Dashboard      /                 [▣ CLT-DevSpec]         (static label, no dropdown)
    Projects       /projects         Plan
  Account                              Overview       /projects/:id            REAL
    Settings       (disabled, Soon)     Context        …/context      disabled, Soon
                                        Discovery Plan …/discovery    disabled, Soon
                                     Run
                                        Meetings       …/meetings     disabled, Soon
                                     Output
                                        Requirements   …/requirements disabled, Soon
                                        Questions      …/questions    disabled, Soon
                                        Decisions      …/decisions    disabled, Soon
                                     Project
                                        Settings       …/settings     REAL, owner only
```

- `NavGroup` in `types/nav.ts` is currently `"Workspace" | "Insights" | "Account"`. The project
  scope needs `"Plan" | "Run" | "Output" | "Project"`; `"Insights"` disappears with the rows that
  used it.
- **Global `Meetings`, `Requirements`, `Questions`, `Decisions`, `Documents` rows are removed.**
  They become project-scoped. `Documents` is the project's Context section and gets no global row.
- **`Conflicts & Gaps` gets no row at all** — it is an analysis view over requirements, not an
  entity. It will be a tab inside Requirements.
- A **member** (not owner) sees no `Settings` row.
- The project switcher is a **static label, not a dropdown**. `← All projects` already covers
  navigation; a dropdown would be a second list query for no new capability.

---

## projects-list — `/projects`

Layout:
```
Projects                                                   [🔔]
Every project you own or were added to.

[⌕ search…………]  [ Active | Archived | All ]      [＋ New project]
┌──────────────────────────────────────────────────────────────┐
│ PROJECT        CUSTOMER  DOMAIN     MEMBERS  STATUS  UPDATED │
│ ▣ CLT-DevSpec   CLT      Logistics  ●●●+2   Active   2h ago ⋯│
│   CLT-DevSpec                                                │
│ ▣ Caris Logis.  Caris    Logistics  ●●+1    Active   Yest.  ⋯│
│──────────────────────────────────────────────────────────────│
│ 1–20 of 37                                      ‹ [1] 2 ›    │
└──────────────────────────────────────────────────────────────┘
```

**Columns**: Project (mark + name + code), Customer / BU, Domain, Members (avatar stack, +N
overflow), Status, Updated, row-menu. **Timeline is deliberately not a column** — it lives on the
detail page; seven columns is already crowded at 1280px.

**States**
| | |
|---|---|
| filled | table + pager. Archived rows are muted with a grey mark so the `All` filter stays readable |
| empty — no projects at all | 🗂 “No projects yet” + “A project is where meeting notes turn into requirements.” + **a `＋ New project` CTA**. Search is disabled |
| empty — search/filter matched nothing | ⌕ “No projects match “<term>”” + “Try a different search term, or switch the status filter.” + **`Clear filters`, no create CTA**. These two empties are different; one component for both is the usual bug |
| loading | skeleton rows in the real table shape |
| error | ⚠ “Couldn’t load your projects” + `Retry`, the same card shape as the existing `dashboard-error` in `app/(app)/page.tsx` |

**Interactions**
- Row click → `/projects/:id`.
- Search is debounced and drives the list query; it does not filter client-side.
- The status segmented control defaults to **Active**.
- Row menu (`dropdown-menu.tsx`): **Open** always · **Archive** (warning-coloured) for an active
  project the viewer owns · **Restore** for an archived one · both **disabled for a non-owner**.
  **There is no Delete anywhere in the UI.**
- `＋ New project` opens the create modal; on success the list refetches and a success toast fires.

---

## project-create-modal — a dialog over `/projects`

Layout:
```
┌─ New project ──────────────────────────────┐
│ Code *      [CLT-DevSpec]                  │
│ Project name * [……………]                     │
│ Customer / BU * [CLT]   Domain * [Logistics]│
│ Objective (optional)                       │
│ [………………………………………………………]                    │
│ Starts on [date]        Ends on [date]     │
│                        [Cancel] [Create]   │
└────────────────────────────────────────────┘
```

**One modal, not the reference image's 3-step wizard.** The wizard's step 2 is document upload,
which needs a project row to attach to — that means a draft-project state machine. Document upload
moves to the project's Context section in a later change instead.

**Required**: code, name, customer / BU, domain. **Optional and nullable**: objective, both dates.
`Create` stays disabled until the four required fields are non-empty.

**States**: empty · filled · submitting (all fields and Cancel disabled, spinner in the primary
button) · field errors · request failed.

**Error handling — this is the part that matters**
- **Duplicate code → a field error under the code input** (“A project with this code already
  exists.”), not a toast. A toast makes the user hunt for which field is wrong.
- **End date before start date → a field error on the end date.** Validated in the DTO only;
  `db.md` deliberately adds no `CHECK (ends_on >= starts_on)` constraint.
- **A failed request keeps the dialog open with every typed value intact**, and shows a banner
  inside the dialog. Losing a filled form to a 500 is the worst outcome on this screen.
- `Domain` is a plain input with a `datalist` of the viewer's existing domains. It is free text —
  the column has no CHECK constraint.

---

## project-detail — `/projects/:id` (Overview)

Layout:
```
CLT-DevSpec  [Active]                              [⚙ Settings]
CLT-DevSpec · CLT · Logistics · 5 members  [Owner]

┌─ 0 ─────┐┌─ 0 ─────┐┌─ 0 ──────────┐┌─ 0 ──────┐
│Context  ││Meetings ││Requirements  ││Open      │
│documents││held     ││collected     ││questions │
└─────────┘└─────────┘└──────────────┘└──────────┘

┌─ Project plan ───────── Stage 1 of 4 ─┐┌─ Project summary ─┐
│ ▬▬▬▬░░░░░░░░░░░░░░░░                  ││ <objective prose> │
│ ① Add context documents  0 files  Soon││ Customer/BU   CLT │
│ ② Generate discovery plan     —   Soon││ Domain  Logistics │
│ ③ Run the meetings    0 of 0 held Soon││ Timeline  Sep–Nov │
│ ④ Draft the requirements 0 drafted Soon││ Members         5 │
└───────────────────────────────────────┘│ Created  …by An Le│
                                          │ Last updated  2h  │
                                          └───────────────────┘
```

**Overview is the project's plan**, not a summary card. The four stages are Clarivo's actual
pipeline — Context → Discovery plan → Meetings → Requirements — each with a real count.

**Every count on this page is genuinely `0` today** and every stage carries a `Soon` badge, because
`add-project-context`, `add-meetings` and `add-requirements` have not shipped. Zero is a true
number. The reference image's **78% health ring and its Known / Unknown / Conflicts / Questions
counters are cut** — nothing in the database can produce them, and an invented percentage survives
into a demo. Building the shape once means later changes fill numbers in without the page changing.

**States**
| | |
|---|---|
| owner | `⚙ Settings` button in the head; `Settings` row in the sidebar |
| member | no Settings button, no Settings row; `Member` badge instead of `Owner` |
| archived | a warning ribbon (“This project is archived… and read-only”) with `Restore`; the plan card freezes and reads “Stopped at stage N”; the project mark goes grey |
| loading | skeletons in the real tile/card shape; the sidebar switcher shows an id-less skeleton |
| not found | 🔍 “Project not found” + “This project doesn’t exist, or you don’t have access to it. Ask the project owner to add you.” + `← Back to projects`. **The sidebar stays in global scope here** — there is no project to scope to |

**A non-member gets the not-found screen, byte-identical to a bad id.** A 403 would confirm the
project exists.

Breadcrumb in the top bar: `Projects / CLT-DevSpec`.

---

## project-settings — `/projects/:id/settings`

**Owner only.** A member has no Settings row, and a direct URL hit renders the same
“Project not found” screen used everywhere else.

Layout: three stacked cards in a `max-w-[760px]` column.
```
┌─ Project details ───────────────────────────┐
│  the same six fields as the create modal     │
│                   [Discard] [Save changes]   │
└─────────────────────────────────────────────┘
┌─ Members ───────────────────────── 5 ───────┐
│ [add a member by email……………] [Add member]   │
│ AL An Le        admin@…    [Owner] [You]    │
│ TN Thu Nguyen   thu@…      [Member]    ✕    │
└─────────────────────────────────────────────┘
┌─ Danger zone ───────────────────────────────┐  warning border
│ Archive this project       [Archive project]│
└─────────────────────────────────────────────┘
```

**One place to administer a project.** Details, members and lifecycle all live here, and **there is
no edit-details modal** — the list's row menu keeps only Open / Archive / Restore.

**Project details**
- Same fields and same validation as the create modal, rendered inline rather than in a dialog.
- `Save changes` is disabled until something actually changes; an `Unsaved changes` badge appears
  in the card header once it is dirty.
- States: pristine · dirty · saving (fields and both buttons disabled) · duplicate-code field error.

**Members**
- Add by **email, matched against an existing Clarivo account**. There is no invite flow and no
  email is sent.
- Add states: idle · adding (spinner, input disabled) · **“No Clarivo account uses this email
  address.”** · **“<Name> is already a member of this project.”** — both field errors, not toasts.
- Each member row: avatar, name, email, role badge, and a `✕` remove button.
- **The owner row has no remove button**, and the viewer's own row is marked `You`. Ownership
  transfer is out of scope — a half-built control is worse than none.
- Solo-project state: one row plus “You're the only member. Add teammates by email so they can open
  this project.”

**Danger zone**
- Active project → `Archive project`, warning-bordered card.
- Archived project → the card turns primary-bordered and offers `Restore project`; the details card
  and member list render disabled, with a ribbon at the top of the page.

**Confirms** — all three go through `useConfirm`, none is a new dialog:
| action | tone | copy |
|---|---|---|
| Remove member | `warning` | “Remove <Name>? They lose access to “<project>” immediately. Anything they already contributed stays.” |
| Archive | `warning` | “Archive this project? “<project>” will be hidden from the active list and become read-only. Nothing is deleted, and you can restore it at any time.” |
| Restore | `confirm` | “Restore this project? “<project>” moves back into the active list.” |

**None of these uses `constants/confirm.ts:confirmDelete`.** That preset is red and says
“permanently deleted. This can't be undone.” — a lie for every action on this page. Add
`confirmArchive` / `confirmRestore` / `confirmRemoveMember` presets beside it.

---

## dashboard — `/` (edits to the existing page)

Three changes to `app/(app)/page.tsx`:

1. **Delete `FeedbackDemoCard`.** Its own `ponytail:` comment says “delete when real screens land” —
   this is that change, and nothing else enforces it.
2. **Remove the Next Meeting card** entirely. No meetings table exists, so there is nothing for it
   to be empty about; `Recent projects` takes the full width instead of sitting beside a
   permanently blank card.
3. **`Total projects` and `Recent projects` become real data.** The other three tiles keep their
   place, read a true `0`, and carry a `Soon` marker — the same honest-zero rule Overview uses, so
   this row is never rebuilt as each later feature lands.

`Recent projects` rows show **customer · domain · member count · updated**, replacing the reference
image's “Last meeting · N requirements” subtitle with columns that exist. Rows link to
`/projects/:id`; `View all →` goes to `/projects`. **Archived projects never appear here.**
Empty state reuses the list page's “No projects yet” block with the `＋ New project` CTA.

---

## Cut from the reference image

| Reference element | Why it is cut |
|---|---|
| 78% project-health ring (screen 5) | No data source. An invented percentage survives into a demo |
| Known 84 / Unknown 23 / Conflicts 4 / Questions 17 (screen 5) | Same — requirements and questions tables do not exist |
| 3-step create wizard (screen 3) | Step 2 is document upload, which needs a draft project row. One modal avoids the whole state machine |
| Upload Files / Existing System / Additional Info tabs (screen 4) | That is the Context section, a later change |
| Next Meeting card (screen 2) | No meetings table |
| “Last meeting · N requirements” card subtitle (screen 2) | Neither value exists; replaced with real columns |
| Meetings / Requirements tabs on the project page (screen 5) | Became project-scoped sidebar rows, shipped disabled with `Soon` |

---

## Verify

`Verify: /devspec-verify add-projects` for every UI section — agent-browser drives the running app
and checks that the regions exist, that styling is not browser-default (the three hand-copied
primitives are the risk), that the layout is aligned, and that **pagination actually walks past
page 1**. A presence-only assertion would pass on a plain unstyled table.

Test credentials and URLs are in `devspec/improve/testing.md` (frontend `:3001`, API `:3000`,
seeded admin `admin@clarivo.local`). **A second account is needed** to exercise the member-vs-owner
and non-member states; `testing.md` records only the one admin today.
