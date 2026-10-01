# UI: add-app-shell

**Mockup**: `mockups/app-shell.html` — approved 2026-09-30 by An Le (9 frames: A expanded · B collapsed rail · C user menu · D/E mobile closed+drawer · F loading · G empty · H error · I dark)

**References**: screen 2 ("Dashboard") of `assets/ChatGPT Image Sep 30, 2026, 02_57_53 PM.png`. Nav item set, stat row, "Recent Projects" / "Next Meeting" split and the footer user block come from it. Deliberate departures from the reference, all approved: nav is **grouped** rather than one flat list of eight; the sidebar is a **floating rounded card** over a full-bleed page canvas rather than a flush flat panel; unbuilt sections carry a **Soon** badge; there is **no search box** and **no mobile bottom tab bar** (reference screen 15 is marked optional and was cut).

**Style source**: every colour, radius and surface in the mockup is copied verbatim from `frontend/app/globals.css` — `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border` (already defined for both `:root` and `.dark`, unused until now), `--card`, `--muted`, `--border`, `--destructive`, `--chart-1..5`, `--radius`. **No new token is introduced by this change.** Typography is `--font-geist-sans` via `next/font` (the mockup falls back to a system stack because a standalone file cannot load it).

---

## Shell layout

Desktop ≥768px, sidebar expanded:

```
┌──────────────────────────────────────────────────────────────┐
│  ╭────────────────────╮                                      │  ← page canvas (--muted)
│  │ ⬢ Clarivo       ⌸  │   Dashboard              🔔          │    is the BASE layer and
│  │                    │  ──────────────────────────────────  │    runs edge to edge
│  │ WORKSPACE          │                                      │
│  │ ▌🅳 Dashboard      │   Good morning, An 👋                │
│  │   🗀 Projects  Soon│   Here's what's happening…            │
│  │   🗓 Meetings  Soon│                                      │
│  │                    │   ┌────┬────┬────┬────┐              │
│  │ INSIGHTS           │   │ 3  │ 12 │ 48 │ 7  │              │
│  │   ☰ Requirements   │   └────┴────┴────┴────┘              │
│  │   ？ Questions     │                                      │
│  │   ⚖ Decisions      │   ┌──────────────┬────────────┐      │
│  │   🗎 Documents     │   │Recent Projects│Next Meeting│      │
│  │                    │   │  row ›        │  title     │      │
│  │ ACCOUNT            │   │  row ›        │  when      │      │
│  │   ⚙ Settings  Soon │   │  row ›        │ [View det] │      │
│  │                    │   └──────────────┴────────────┘      │
│  │ ──────────────     │                                      │
│  │ (AL) An Le      ⌃⌄ │                                      │
│  │      BA            │                                      │
│  ╰────────────────────╯                                      │
└──────────────────────────────────────────────────────────────┘
      ↑ sidebar is a FLOATING CARD above the canvas:
        12px margin · radius 18px · 1px --sidebar-border · soft shadow · z-index above content
```

Measurements, as approved:

| | expanded | collapsed |
|---|---|---|
| sidebar flex basis | 264px | 72px |
| margin | 12px (top/bottom/left) | 12px |
| radius | 18px | 18px |
| nav item height | 38px, radius 10px | 38px, icon centred |
| topbar height | 58px, transparent, no bottom border | same |

## Sidebar

**Groups** (headings are `10.5px / 600 / .09em` uppercase in `--muted-foreground`):

| Group | Items |
|---|---|
| Workspace | Dashboard · Projects · Meetings |
| Insights | Requirements · Questions · Decisions · Documents |
| Account | Settings |

Only **Dashboard** is live (`/`). The other seven render dimmed (`opacity .55`), are not links, do not hover-highlight, and carry a `Soon` badge (`--muted` fill, `--border` outline, uppercase 9.5px).

**Active item**: background `--sidebar-primary` at 12% + text/icon in `--sidebar-primary` + a 3px full-height accent bar on the left edge of the item.

**Collapsed rail (72px)**: labels, `Soon` badges, the brand wordmark, the collapse button and the user's name/role are all hidden. Group headings become a hairline divider (a faded `--sidebar-border` rule) so the grouping survives. Hovering an item shows its label as a tooltip to the right (`--foreground` fill, `--background` text, 7px radius, left-pointing arrow). The collapse toggle moves into the content topbar, because the rail's header has no room for it.

**Collapse state**: persisted in a cookie so the server renders the correct width on first paint — no flash. `⌘B` / `Ctrl+B` toggles it from anywhere in the shell.

## Sidebar footer — user block

Replaces `components/auth/user-chip.tsx` entirely (that file is deleted).

```
 ╭──────────────────────╮
 │ An Le                │   ← menu, opens upward
 │ an.le@…              │
 │ ─────────────────────│
 │ 👤 Profile      Soon │   dimmed
 │ ⇥  Sign out          │   --destructive text
 ╰──────────────────────╯
 ┌──────────────────────┐
 │ (AL)  An Le       ⌃⌄ │   ← trigger row (highlighted while open)
 │       BA             │
 └──────────────────────┘
```

- Avatar is initials on a `--chart-3 → --chart-1` gradient, 32px, radius 10px.
- Row shows **name** (600/13px) and **role** (11.5px, `--muted-foreground`). E-mail is *not* on the row — it lives in the menu header, so a long address cannot break the layout.
- Menu items: `Profile` (dimmed + `Soon`) and `Sign out` (`--destructive`). Sign out is the only live action.
- Collapsed rail shows the avatar alone; clicking it opens the same menu beside the rail.

## Content — dashboard

All data is **static sample data**; no endpoint exists for any of it yet.

- **Greeting**: `Good morning, An 👋` — the time-of-day word is derived from the client clock (morning / afternoon / evening); the name comes from the auth store. Subtitle: `Here's what's happening with your projects.`
- **Stat row**: 4 cards — Total Projects `3`, Meetings `12`, Requirements `48`, Open Questions `7`. Each is value (26px/700) over label (12px `--muted-foreground`), with a 34px tinted rounded square holding the section's icon (tints from `--chart-1`, `--chart-2`, `--chart-3`, `--chart-5`).
- **Recent Projects** card (1.6fr): three rows — 36px gradient tile, project name, `Last meeting: <date> · N requirements`, chevron. Rows hover-highlight and are separated by a hairline. Header carries a `View all` link (inert).
- **Next Meeting** card (1fr): title, `Oct 2, 2026 · 10:00 AM`, two pills (`3 topics`, `5 questions`), a full-width primary `View details` button (inert).
- **Topbar**: breadcrumb (`Dashboard`), spacer, notification bell with a `--destructive` dot. Bell is inert.

## States

| State | What renders |
|---|---|
| **loading** (auth `status: "unknown"`) | Full shell, nav in place. User block and all content are `--muted` skeleton blocks. **Never redirects** — the cookie has not been checked yet, so a redirect here would bounce a signed-in user to `/login`. |
| **authenticated** | Frame A. |
| **anonymous** | No shell at all — redirect to `/login`. |
| **empty** | Stats render `0` (not hidden). Each card shows its own empty block: icon + heading + one line ("No projects yet" / "Nothing scheduled"). Subtitle changes to "Nothing here yet — create your first project to get started." |
| **error** | Shell survives; only the content region is replaced by icon + "Couldn't load your dashboard" + one line + a ghost `Retry` button. A **401 is not this state** — it clears the auth store and redirects to `/login`. |
| **dark** | Frame I. Canvas becomes `--background` (navy), sidebar `--sidebar` (lighter) — the float reads stronger than in light. No new tokens. |

## Mobile (<768px)

- No sidebar. Top bar: hamburger · brand · spacer · bell.
- Hamburger opens the **same nav** as a left drawer — inset 12px, radius 18px, its own shadow, over a `rgba(15,23,42,.45)` scrim. Closes on scrim click, on the drawer's X, and on `Esc`.
- **No bottom tab bar** (cut from reference screen 15).
- Stats go 4 → 2 columns; the two content cards stack to one column; paddings drop from 26px to 16px.

## Interactions

| Trigger | Result |
|---|---|
| Click collapse toggle / `⌘B` / `Ctrl+B` | Sidebar 264px ⇄ 72px, cookie written |
| Click a `Soon` item | Nothing — not a link, no navigation, no hover state |
| Click user row | Menu opens upward; row highlights; `Esc` or outside click closes |
| Click `Sign out` | Logout mutation → auth store cleared → redirect `/login` |
| Hover a rail icon (collapsed) | Tooltip with the item's label |
| Mobile hamburger | Drawer opens; scrim / X / `Esc` close it |
| Resize across 768px | Drawer state and sidebar state are independent — crossing the breakpoint never leaves a half-open overlay |

## Components

Existing, reuse as-is:

- `public/images/clarivo-mark.png` — the brand mark in the sidebar header and the mobile drawer, beside a text wordmark. `clarivo-logo.png` is a *stacked* lockup on a white plate and does not fit a 60px header row; the login page uses the mark asset the same way.
- `frontend/components/ui/button.tsx:Button` — `View details` (default), `Retry` (`variant="outline"`), every icon button (`variant="ghost" size="icon"`).
- `frontend/lib/utils.ts:cn` — every conditional class.
- `frontend/stores/auth.ts:useUser` / `useAuthStore` — name, role and email for the footer; `status` for the loading/redirect gate.
- `frontend/hooks/use-auth.ts:useLogout` — the `Sign out` action.
- `lucide-react` for every icon (already a dependency): `LayoutDashboard`, `FolderKanban`, `CalendarDays`, `ListChecks`, `CircleHelp`, `Scale`, `FileText`, `Settings`, `PanelLeft`, `Bell`, `ChevronRight`, `ChevronsUpDown`, `LogOut`, `User`, `Menu`, `X`, `TriangleAlert`.

To add by hand — **the shadcn CLI hangs in this repo** (`devspec/context/rules.md`), so each is copied from ui.shadcn.com into `frontend/components/ui/` by hand; every radix dependency they need is already covered by the installed `radix-ui` umbrella package:

- `avatar.tsx:Avatar` / `AvatarFallback` — footer + rail
- `dropdown-menu.tsx:DropdownMenu…` — footer menu
- `card.tsx:Card` / `CardHeader` / `CardContent` — stat and content cards
- `badge.tsx:Badge` — the `Soon` badge and the meeting pills
- `skeleton.tsx:Skeleton` — the loading state
- `tooltip.tsx:Tooltip…` — collapsed-rail labels
- `sheet.tsx:Sheet…` — the mobile drawer
- `separator.tsx:Separator` — footer rule and the collapsed group dividers

To build (no existing equivalent): the sidebar itself — the floating card, its collapse state + cookie, the `⌘B` handler, the nav item, the group heading, the rail behaviour. Option B was chosen over vendoring shadcn's `sidebar` block; see `design.md`.

**Deleted**: `frontend/components/auth/user-chip.tsx` — the footer user block absorbs it. `frontend/app/page.tsx`'s Next.js scaffold content is replaced by the dashboard.
