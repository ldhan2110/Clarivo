# Verify: add-login  (app vs mockup)

Re-run after fixes. App `http://localhost:3001/login`, reference
`mockups/login.html`. Widths checked: 390 / 700 / 1180.

## login — PASS

No outstanding mismatches.

### Fixed during this run

- card `max-width` at >=900px was `452px`, should be `960px`. `sm:max-w-[452px]`
  won at every width above 900 because Tailwind emits custom breakpoints
  (`min-width:900px`) *before* the built-in `sm`/`md`, regardless of value —
  confirmed by reading the generated CSS. Fixed by making the ranges
  non-overlapping (`sm:max-panel:` / `panel:`) rather than relying on cascade order.
- input `font-size` at >=900px was `16px`, should be `15px`. Same root cause via
  the `md:text-sm` baked into the shadcn `Input`; removed it from the component so
  size is set per-usage.
- input and button `border-radius` was `14px`, should be `12px` — `rounded-xl`
  resolves against this project's `--radius-xl` (`calc(var(--radius) + 4px)`),
  not Tailwind's stock 12px. Pinned to `rounded-[12px]`.

### Verified

| Check | Result |
|-------|--------|
| Structural: email, password, submit, checkbox, logo | all present and visible |
| Button `background-color` vs `--primary` | exact match — project `<Button>` reused, no styling drift |
| Card layout | `block` at 390/700, `grid 48%/52%` at 1180 |
| Card `max-width` | 440 / 452 / 960 |
| Control heights | 50px below 900, 46px above — matches `ui.md` |
| Input `font-size` | 16px on mobile (iOS Safari will not zoom), 15px at >=900 |
| Radii | inputs/button 12px, card 20px |
| Alignment | all form elements share one `x` in both documents |
| Illustration | `background-image: none` below 900px — not requested at all; loaded only at >=900 |
| Empty submit | per-field errors, border switches to `--destructive`, no request sent |
| Wrong password | single banner "Incorrect email or password.", neither field marked invalid |
| Successful login | redirects to `/`, middleware admits the session |
| Pagination | none on this screen |

Screenshots: `login-390.png`, `login-1180.png`, `after-login.png`.
