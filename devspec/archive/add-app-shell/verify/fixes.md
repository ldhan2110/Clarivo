# Verify fixes: add-app-shell  (app vs mockups/app-shell.html)

Run: 2026-10-01 · app at http://localhost:3001 · API :3000 · account `admin@clarivo.local`

## shell (desktop 1280×800) — PASS
Sidebar, nav, footer and dashboard match the approved mockup on every compared property.

| element | property | mockup | app | verdict |
|---|---|---|---|---|
| sidebar card | width / radius / border / margin | 264px / 18px / 1px / 12px | 264px / 18px / 1px / 12px | match |
| sidebar card | background | `--sidebar` | `--sidebar` | match |
| active nav item | bg / radius / height / weight | primary@12% / 10px / 38px / 600 | primary@12% / 10px / 38px / 600 | match |
| active nav item | gap | 11px | 12px | within tolerance |
| disabled nav item | opacity / height | 0.55 / 38px | 0.55 / 38px | match |
| stat card | radius / border / bg | 14px / 1px / `--card` | 14px / 1px / `--card` | match |
| stat card | padding | 16px 16px 14px | 16px | within tolerance (2px) |
| stat value | font-size / weight | 26px / 700 | 26px / 700 | match |
| page canvas | background | `--muted` | `--muted` | match |

## Accepted deviation — primary button
- `View details` button: mockup `height 38px, radius 10px, font 13.5px/600`; app `36px, 8px, 14px/500`.
  **No fix.** The app reuses `components/ui/button.tsx:Button`, which `ui.md` names as the component
  to reuse. The mockup's `.btn` was hand-styled for a standalone file; the design system's own metrics
  win over mockup pixels. Hand-styling a one-off here is exactly the reuse drift verify exists to catch.

## Defect found and fixed during this run
- Collapse state did not survive a reload: `SIDEBAR_COOKIE` was exported from the `"use client"`
  `sidebar-context.tsx`, so the server layout received a client-reference proxy rather than the string
  and `cookies().get()` always missed — `defaultOpen` was stuck `true`. Moved the constant to a plain
  module `components/nav/sidebar-cookie.ts`. Re-verified: collapsed→reload→collapsed, expanded→reload→expanded.

## Behaviour checks — all PASS
- collapse 264⇄72, cookie `sidebar_state` written, `⌘B` toggles, state survives reload (both directions)
- collapsed rail: labels/badges/wordmark hidden, hover shows tooltip ("Dashboard")
- 8 nav items, 3 groups; exactly 1 anchor (Dashboard); 7 disabled render `<span aria-disabled>` — clicking all 7 leaves the URL at `/`
- footer menu holds name + `admin@clarivo.local`; e-mail is NOT on the row; `Profile` disabled with `Soon`
- `Sign out` → `/login`
- dashboard: greeting names the user, 4 stat cards (3/12/48/7), 3 project rows, Next Meeting card; no Next.js scaffold text
- dark theme: sidebar + canvas + text all on dark tokens, nothing left on a light background
- mobile 390×844: no persistent sidebar, hamburger opens drawer (inset 12px, radius 18px, scrim), 8 items in 3 groups, `Escape` closes, **no bottom bar**
- no horizontal scroll at 390 / 1280

## Note
The dark circle at the sidebar's bottom-left corner in `desktop-expanded.png` is the Next.js dev-tools
badge, not app UI. The real avatar is `AL` on the chart-3→chart-1 gradient, 32×32, inside the card.
