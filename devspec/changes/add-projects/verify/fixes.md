# Verify fixes: add-projects  (app vs mockup)

Run 2026-10-01, app at http://localhost:3001 (API :3000), account `admin@clarivo.local`.
Reference: `mockups/*.html` · candidate: the running app.

## Result: PASS — 0 blocking mismatches

| screen | verdict | evidence |
|---|---|---|
| projects-list | PASS | `verify/projects-list.png`, `verify/projects-list-no-match.png` |
| project-create-modal | PASS | `verify/project-create-modal.png` |
| project-detail | PASS | `verify/project-detail.png` |
| project-settings | PASS | `verify/project-settings.png` |
| dashboard | PASS | `verify/dashboard.png` |

### Structural
Every region named in `ui.md` is present and visible on each screen: list header, search,
status segmented control, `New project`, table, pager; modal with all six fields; detail
header, four stat tiles, plan card, summary card; settings details/members/danger-zone cards;
dashboard stat row + Recent projects.

### Visual (computed-style diff, mockup ↔ app)
No categorical mismatch. Spot values:

| element | property | mockup | app |
|---|---|---|---|
| primary button | background-color | `rgb(58,117,253)` | `rgb(58,117,253)` ✓ |
| body text | color | `rgb(22,33,61)` | `rgb(22,33,61)` ✓ |
| create dialog | padding / radius / width | `22px` / `14px` / `560px` | `22px` / `14px` / `560px` ✓ |
| detail cards | bg / radius / border | white / `14px` / `1px` | white / `14px` / `1px` ✓ |
| stat tile | padding / radius | `15px` / `14px` | `16px` / `14px` ✓ |
| table cell | padding-top | `12px` | `12px` ✓ |

Nothing is zero-size, off-canvas or overlapping, and no screen scrolls horizontally at 1440px.

### Pagination — walked past page 1
25 active projects seeded. Page 1 `1–20 of 25`, first rows `Verify fixture 24 | 23 | 22`.
After `Next page`: `21–25 of 25`, 5 rows, first rows `Verify fixture 04 | 03 | 02` — different
content, so a second fetch really happened. `Next` disabled at the end, `Previous` enabled.
Search is server-driven too: `VER-1` narrows to `1–10 of 10`, `zzzznope` renders the
"No projects match" state (distinct from "No projects yet").

## Noted, not failed

- **Search input `background-color`**: mockup `oklch(1 0 0)` (white), app `transparent`.
  The app reuses `components/ui/input.tsx:Input`, which is `bg-transparent` by design, and
  task 9.3 mandates that reuse. Component reuse wins over the mockup's approximation.
- **Type scale**: mockup hand-writes `13.5px/600` where the app's shadcn components use
  `14px/500`. The app is on the design system; the mockup was approximating it.
- **Button radius** `10px` (mockup) vs `8px` (app `Button`) — same reason.
- Two zero-size buttons on desktop (`Open navigation`, `Notifications`) are the mobile top bar
  hidden by `md:hidden`. Pre-existing `add-app-shell` behaviour, untouched by this change.
