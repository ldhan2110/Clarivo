# Proposal: add-projects

_approved_by: LE AN_
_approved_at: 2026-10-01_


## Why

Clarivo turns meeting conversations into structured requirements. **Every one of those artifacts
hangs off a project** — context documents, the AI discovery plan, meetings, requirements, questions,
decisions. Nothing downstream can be built until the container exists.

Today the repository has `users` and `files` and nothing else. The sidebar's `Projects` row is
disabled with a `Soon` badge, the dashboard's "Recent Projects" card is hardcoded sample data, and
`files` sits with no consumer at all. This change is the first domain spine: it creates the project,
decides who can see it, and establishes the navigation every later feature plugs into.

## What it delivers

**Backend**
- `projects` and `project_members` tables, one additive migration.
- Membership-scoped CRUD: a project is visible only to its owner and the people added to it.
- Archive and restore as a status transition. **Nothing is ever hard-deleted.**
- Member management: add an existing account by email, remove, owner fixed.

**Frontend**
- `/projects` — searchable, filterable, paginated list with a create modal.
- `/projects/:id` — the project's **plan**: four pipeline stages (Context → Discovery plan →
  Meetings → Requirements) with real counts, plus a summary card.
- `/projects/:id/settings` — owner-only: details, members, archive / restore.
- **A second sidebar scope.** Entering a project swaps the global nav for that project's sections,
  all of which ship disabled with the existing `Soon` badge except Overview and Settings.
- Dashboard: the `ponytail:` demo card is deleted, `Total projects` and `Recent projects` become
  real, the Next Meeting card is removed.

## Scope — in

| | |
|---|---|
| `projects` table | code (globally unique), name, customer/BU, domain, objective, status, start/end dates, created_by |
| `project_members` table | project ↔ user with an `owner` / `member` role and a composite unique |
| Endpoints | list (paginated, searchable, status-filtered), get one, create, update, archive, restore, list members, add member, remove member |
| Access model | membership-scoped everywhere; a non-member gets **404, never 403** |
| Screens | list, create modal, detail/overview, settings, dashboard edits |
| Navigation | global ↔ project scope switch, one source for desktop and mobile |
| Schema conventions | first enum (varchar + CHECK), first composite unique, first `date` columns — all recorded in `devspec/context/schema.md` |

## Scope — out

- **Document upload.** The Context section ships as a disabled `Soon` row; `files` stays unconsumed
  until `add-project-context`.
- **Meetings, requirements, questions, decisions, discovery plan.** Their nav rows exist and are
  disabled. Their counts on Overview are genuinely `0`.
- **Project health %, and the Known / Unknown / Conflicts / Questions counters** from the reference
  image. No data source exists; an invented percentage survives into a demo.
- **Ownership transfer.** The owner row has no remove control.
- **Invite flow.** A member is added by matching an existing Clarivo account's email. No email is
  sent, and an unknown address is a validation error, not a pending invitation.
- **Hard delete.** Not reachable from the UI and not implemented in the service.
- **Cross-project views** of meetings or requirements. Those nouns are project-scoped by design.

## Decisions already settled

Carried in from exploration so they are not relitigated. The *why* for each lives in `design.md`
and `db.md`.

| Decision | |
|---|---|
| Create is a **single modal**, not the reference image's 3-step wizard | the wizard's upload step needs a draft project row |
| Delete is **archive** (`status='archived'`), not a soft-delete column | the repo has no soft delete anywhere |
| Project `code` is **globally unique** | one index, one error message, no coupling to customer |
| Visibility is **membership-scoped** | you see a project you own or were added to |
| A non-member gets **404** | a 403 confirms the project exists |
| Enums are **varchar + CHECK**, not a pg enum type or a lookup table | sets the precedent for every enum after it |
| `domain` gets **no CHECK** | it is customer data that grows; a constraint makes each new vertical a migration |
| Sections live in the **sidebar**, not in page tabs | a BA works inside one project at a time |
| Overview is a **plan view with honest zeros** | zero is true; 78% is not |
| Settings is **owner-only** and absorbs editing | one place to administer a project |

## Risk

- **The nav rewrite is the one shared-surface change.** `constants/nav.ts` currently feeds both the
  desktop sidebar and the mobile drawer from a single array; splitting it into two scopes must keep
  that single-source property or the two will drift.
- **Three UI primitives must be hand-copied** (`dialog`, `table`, `textarea`) because the shadcn CLI
  hangs in this environment. Transcription error is the most likely defect in this change.
- **Verification needs a second user account.** `devspec/improve/testing.md` records only
  `admin@clarivo.local`, which cannot exercise the member, non-owner or non-member states.

## Relationship to other changes

`depends_on: []`. This change consumes `add-login`'s output (the `users` table, `JwtAuthGuard`,
`SESSION_COOKIE`) and `add-app-shell`'s sidebar, both already built and verified in the working
tree. `add-login` sits at `status: blocked` only on the pre-existing `test/app.e2e-spec.ts` failure,
which has nothing to do with projects — the same reasoning `add-app-shell`, `add-feedback-layer` and
`add-file-storage` each recorded.

It **unblocks** `add-project-context` (the first `files` consumer), `add-meetings` and
`add-requirements`, each of which fills one disabled sidebar row and one Overview stage.
