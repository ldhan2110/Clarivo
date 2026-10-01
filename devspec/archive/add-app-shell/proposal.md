_approved_by: LE AN_
_approved_at: 2026-10-01_

# Proposal: add-app-shell

## Why

`add-login` shipped a login page and a cookie session, but there is nothing to log *in to*. `frontend/app/page.tsx` is still the Next.js starter scaffold with a `<UserChip>` bolted on, and there is no navigation of any kind — no way to see the product's shape, and no place for the next fourteen screens to land.

This change builds the frame the rest of the MVP hangs off: a persistent sidebar shell around every authenticated route, plus one real screen inside it (the dashboard) so the shell is visibly working rather than an empty chrome.

It also settles three things every later screen inherits: where authenticated routes live (`app/(app)/`), how a page gets its navigation, and how the signed-in user is presented.

## What it delivers

1. **A route group for authenticated pages** — `app/(app)/`, with an auth guard in its layout. `(auth)/login` stays outside it and is untouched.
2. **A collapsible sidebar** — 264px expanded ⇄ 72px icon rail, a floating rounded card over a full-bleed page canvas. Collapse state persists in a cookie (no flash on reload) and toggles with `⌘B`.
3. **Grouped navigation, eight items** — Workspace (Dashboard, Projects, Meetings) · Insights (Requirements, Questions, Decisions, Documents) · Account (Settings). Only **Dashboard** is live; the other seven render dimmed with a `Soon` badge.
4. **A mobile drawer** — below 768px the sidebar is replaced by a hamburger that opens the same nav as an inset drawer over a scrim.
5. **A sidebar footer user block** — avatar, name, role, and a menu holding the e-mail and **Sign out**. This replaces and deletes `components/auth/user-chip.tsx`.
6. **A sample dashboard** at `/` — greeting, four stat cards, a Recent Projects list and a Next Meeting card, modelled on screen 2 of the product mockup. **All of it is static sample data.**

Approved shape: `mockups/app-shell.html` (9 frames) → `ui.md`.

## Scope

**In**

- `app/(app)/layout.tsx` (guard + shell) and `app/(app)/page.tsx` (dashboard), replacing the scaffold at `app/page.tsx`
- The sidebar, nav item list, mobile drawer, and footer user block as new components
- Eight shadcn primitives hand-copied into `components/ui/` (avatar, dropdown-menu, card, badge, skeleton, tooltip, sheet, separator) — the CLI hangs in this repo
- Loading / empty / error / dark states for the dashboard region
- Deleting `components/auth/user-chip.tsx`; dropping `flex-col` from the `<body>` in `app/layout.tsx`

**Out**

- Any of the seven `Soon` sections — no routes, no stub pages, no placeholder screens
- Any backend work. No endpoint, no entity, no migration. Nothing in `backend/` is touched
- Real dashboard data. The numbers, projects and meeting are hardcoded sample values; wiring them is a later change per section
- A `⌘K` command palette and a sidebar search box — considered and cut
- A mobile bottom tab bar (reference screen 15) — considered and cut in favour of the drawer alone
- A theme toggle. The dark palette is honoured, but nothing in this change switches it
- Notifications. The topbar bell renders with its dot and does nothing

## Risks

- **`frontend/app/page.tsx` disappears** as a route file; `/` is served by `app/(app)/page.tsx` instead. Two files cannot own `/` — the old one must be deleted in the same step, not left behind.
- **Eight primitives are transcribed by hand** because the shadcn CLI hangs (`devspec/context/rules.md`). Transcription errors are the most likely defect in this change; each one is checked by `tsc` and by rendering it.
- **`devspec/context/conventions.md` is stale** about the frontend — it describes `@/*` → `./app/*` and everything under `app/`, which `add-login` changed. `frontend/CLAUDE.md` is authoritative. Flagged in `design.md`; refreshing the context pack is a separate job.
- **`add-login` is `status: blocked`** on the board, but only on a pre-existing e2e test unrelated to this work. Its auth store, hooks and services are built and verified, so this change is not actually blocked by it.
