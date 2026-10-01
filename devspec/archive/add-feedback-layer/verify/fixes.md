# Verify fixes: add-feedback-layer  (app vs mockup)

Run: 2026-10-01, agent-browser 0.38.1, app at http://localhost:3001, 1280x900 + 390x844, light + dark.

**Status: PASS — no outstanding fixes.** Five mismatches were found on the first pass and all five
were fixed and re-measured in this run; they are kept below as the record of what changed.

## Measured — PASS
**toast** — offset top 16 / right 16 desktop, top 66 / left-right 16 mobile; width 364 desktop, 358 at
390px; radius 12px; padding 14px; `--popover` surface with a 1px `--border`; stack gaps 10px / 10px;
3 visible with the 4th `data-visible=false` (queued, not mounted); icon 26px; title 13.5px/600;
description 12.5px/400 `--muted-foreground`; close 18px box / 13px glyph / radius 4px / opacity 0.55,
inset right 15px; two-layer shadow matches the mockup; clears the mobile app bar (bar bottom 43 <
toast top 66); no horizontal scroll.

**confirm dialog** — 440px desktop, 358px with 16px gutters at 390px, centred; radius 14px; padding
22/22/18 desktop and 20/20/16 mobile; 1px `--border`; `--popover` surface; overlay `--foreground`/45%;
icon 28px top-aligned at `-1px`; title 16px/600; description 13px/400 muted at `margin-top: 7px`;
buttons h-36 / radius 8px / 14px-500, right-aligned with an 8px gap, side by side at 390px; confirm
focused at open; `destructive` variant only for `tone: "error"`; two-layer shadow matches the mockup.

**behaviour** — pending keeps the dialog open with both buttons disabled (opacity 0.5, pointer-events
none), a 15px spinner and an unchanged label, and blocks both Esc and overlay click; a rejected
`onConfirm` closes the dialog and raises exactly one error toast, and a second failure REPLACES it via
the fixed id (count stays 1); sign-out cancel is a no-op (stays on `/`, 0 toasts, still signed in) and
sign-out confirm redirects to `/login` with a "Signed out" success toast; a bad login shows the 401
inline once and raises 0 toasts; every tone icon resolves to its exact token in light AND dark, the
surfaces use the `.dark` `--popover`, and the destructive button computes `oklab(… / 0.6)` =
`dark:bg-destructive/60`. No pagination on either surface.

## Fixed this run (were FAIL on the first pass)
- [x] toast `box-shadow`: was sonner's default `rgba(0,0,0,0.1) 0 4px 12px`, now the mockup's two
  layers. Two causes at once — a bare comma inside a Tailwind `shadow-[...]` arbitrary value drops the
  whole declaration, and the class would still lose to `[data-sonner-toast][data-styled=true]` (0,3,0).
  Moved to a `.shadow-toast` rule in `globals.css` `@layer utilities` with a `.dark` variant and
  `!important`.
- [x] toast stack `gap`: was collapsed (`gaps: [-57.6, -54.1, -50.7]`, `data-expanded=false`), mockup
  has 10px. `gap={10}` only applies to an expanded stack — added the `expand` prop to `<Toaster>`.
- [x] close button position: was inset right 21.3px / top 8.7px, mockup is right 15px / top 16px.
  Sonner's `transform: translate(-35%, -35%)` survived `translate-none`, which sets the `translate`
  property rather than `transform`. Now `transform-none!` — measured right 15px / top 15px.
- [x] dialog `box-shadow`: was all-transparent (declaration dropped, same bare-comma cause), now the
  mockup's two layers via a `.shadow-dialog` rule with its `.dark` variant.
- [x] dialog mobile padding: was the desktop `22px 22px 18px` at 390px, `ui.md` specifies `20px` sides
  and top with `16px` bottom. Now `p-[20px] pb-[16px] md:p-[22px] md:pb-[18px]` — measured 20/20/16.

Baselines for regression: `verify/baseline/{desktop,mobile}-{light,dark}-{toasts,dialog}.png`.
