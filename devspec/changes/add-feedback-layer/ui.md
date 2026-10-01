# UI: add-feedback-layer

**Mockups** (approved 2026-10-01 by An Le):
- `mockups/toast-stack.html` — 4 frames: A three stacked over the app canvas (light + dark, 4th toast dimmed to show the queue), B the four tones isolated + a title-only variant, C the two new tokens with swatches, D measurements.
- `mockups/confirm-dialog.html` — 5 frames: A destructive dialog in context (light + dark), B four idle shapes, B′ all five tones, C pending, D resolved (success toast / failure toast), E measurements.
- `mockups/mobile.html` — 3 frames: A toast at 390px with the 58/66px offset guides drawn, B confirm dialog at 390px, C mobile-vs-desktop measurements.

**References**: no new reference image. Both surfaces are siblings of the shipped app shell — `devspec/archive/add-app-shell/mockups/app-shell.html` supplied the visual language (floating card over a `--muted` canvas, 58px transparent topbar, mobile bar of `hamburger · brand · spacer · bell`, no bottom tab bar) and the mockups reproduce that canvas so the new surfaces are judged in place rather than on a blank page.

**Style source**: every colour, radius, height and weight is copied from the real files.
- Tokens from `frontend/app/globals.css` — `--popover`, `--popover-foreground`, `--border`, `--muted`, `--muted-foreground`, `--accent`, `--primary`, `--destructive`, `--input`, `--ring`, `--card`, `--sidebar*`.
- Button geometry and variants from `frontend/components/ui/button.tsx` — default size (h-9/36px, px-4, radius-md, 14px/500), `outline`, `default`, `destructive` including `dark:bg-destructive/60`, and the `--ring/50` 3px focus ring.
- Overlay from `frontend/components/ui/sheet.tsx` — `bg-foreground/45`, reused unchanged.
- Surface recipe from `frontend/components/ui/card.tsx` / `dropdown-menu.tsx` — `--popover` fill, 1px `--border`.
- Icons are `lucide-react` glyphs redrawn as flat solids (see below). Typography is `--font-geist-sans`; the standalone mockups fall back to a system stack because a single file cannot load `next/font`.

**New tokens** — the only two this change adds, in `:root`, `.dark` and `@theme inline`:

| Token | `:root` | `.dark` | Why |
|---|---|---|---|
| `--success` | `oklch(0.58 0.14 157)` | `oklch(0.72 0.16 157)` | Same lightness pair as `--destructive` (0.577 / 0.704) so all tones carry one visual weight |
| `--warning` | `oklch(0.70 0.15 75)` | `oklch(0.80 0.15 80)` | Deliberately lighter than the rest — amber at L 0.58 reads brown, not warning |

Neither gets a `--*-foreground` pair: tone never fills a surface in this change, so nothing is ever laid on top of these colours. Add the pair the day a `success` Button variant exists.

`info` deliberately reuses `--primary` (the brand blue). No `--info` token.

---

## toast

Layout — viewport is top-right, stacking downward:

```
                                      ┌──────────────────────────────────┐
                                      │  ●●   Project created         ✕  │
                                      │ ████  "Clarivo API v2" is ready  │
                                      │  ●●   for its first meeting.     │
                                      └──────────────────────────────────┘
                                      ┌──────────────────────────────────┐
                                      │  ▲    2 requirements conflict  ✕ │
                                      │ ███   REQ-14 and REQ-27 …        │
                                      └──────────────────────────────────┘
                                      ┌──────────────────────────────────┐
                                      │  ✖    Couldn't upload document ✕ │
                                      │ ███   The file is larger than …  │
                                      └──────────────────────────────────┘
   ↑ icon is 26px, flat solid           ↑ max 3 mounted; a 4th waits in the queue
     fill in the tone colour, glyph
     knocked out in --popover, and
     vertically centred so it spans
     title through description
```

**Tone lives in the icon and nowhere else.** No coloured rail, no tinted background, no coloured border or edge. The surface is always `--popover` / `--popover-foreground` / 1px `--border`, identical to the existing dropdown-menu, so a toast and the user menu read as the same material. This is why sonner's `richColors` is rejected — it floods the whole surface and stops matching the app.

| Tone | Colour | Glyph (flat solid, knocked out) |
|---|---|---|
| `success` | `--success` | filled circle + check |
| `info` | `--primary` | filled circle + `i` |
| `warning` | `--warning` | filled rounded triangle + `!` |
| `error` | `--destructive` | filled circle + `✕` |

Measurements:

| | Desktop | Mobile (<768px) |
|---|---|---|
| viewport offset | top 16px, right 16px | top **66px**, left/right 16px |
| toast width | 364px fixed | fluid — 358px at 390px wide |
| why that top offset | no topbar to clear | 58px top bar + 8px, so it never covers the hamburger or the bell |
| gap between toasts | 10px | 10px |
| radius | 12px — matches dropdown-menu | 12px |
| padding | 14px, even on all sides | 14px |
| icon | 26px, `var(--tone)` fill, `--popover` knockout, 12px to the text | same |
| title | 13.5px / 600 / `--popover-foreground` | same |
| description | 12.5px / 400 / `--muted-foreground`, 3px below the title | same |
| close | 13px ✕, `--muted-foreground` at 55% → 100% + `--accent` on hover | same |
| duration | 4s | 4s |
| stack cap | 3 | 3 — ~265px of a 560px viewport; not reduced to 2, since filling it needs three simultaneous failures and it clears in 4s |

States: `description` is optional — a title-only toast collapses to two columns and keeps the icon. Nothing else varies; a toast has no loading or empty state.

Components: `sonner`'s `<Toaster>`, wrapped in `frontend/components/ui/sonner.tsx` and styled through `toastOptions.classNames` with the tokens above. **No `theme` prop and no `richColors`** — the wrapper uses Tailwind classes so the toast follows the `.dark` class the day something sets it. There is no `useToast` hook; `toast` imports from `sonner` directly.

## confirm dialog

Layout — Radix `AlertDialog`: overlay + centred card.

```
   ┌──────────────────────────────────────────────┐
   │  ●●                                          │
   │ ████   Delete project?                       │
   │  ●●    "Clarivo API v2" will be permanently  │
   │        deleted, along with all meetings and  │
   │        requirements in it. This can't be     │
   │        undone.                               │
   │                                              │
   │                   [ Cancel ]  [  Delete  ]   │
   └──────────────────────────────────────────────┘
     ↑ 28px flat icon, same treatment as the        ↑ right-aligned, 8px gap.
       toast, top-aligned to the title because        Cancel = outline,
       a description runs several lines               Confirm = default or
                                                      destructive
```

`tone` drives exactly two things: which icon appears, and whether the confirm button is `variant="destructive"` (`"error"` only) or `variant="default"` (every other tone). The dialog surface never tints.

| `tone` | Colour | Glyph | Confirm button |
|---|---|---|---|
| `confirm` *(default)* | `--primary` | filled circle + `?` | `default` |
| `success` | `--success` | filled circle + check | `default` |
| `info` | `--primary` | filled circle + `i` | `default` |
| `warning` | `--warning` | filled triangle + `!` | `default` |
| `error` | `--destructive` | filled circle + `✕` | `destructive` |

`confirm` and `info` share `--primary` and are told apart by the glyph, not the hue — a third blue would be noise.

States:

| State | What it looks like |
|---|---|
| **idle** | As drawn. Focus is on the confirm button at open and trapped in the dialog. |
| **no description** | `description` omitted — the title sits alone beside the icon, actions move up. |
| **pending** | Only when `onConfirm` returns a promise. The dialog **stays open**; both buttons go `disabled` (50% opacity, pointer-events off); a 15px spinner appears on the confirm button. The confirm **label does not change** — the spinner already says the work is running, so there is no `pendingLabel` to pass or translate. |
| **resolved** | Dialog closes. Reporting is the caller's job — its `onSuccess` toasts. |
| **rejected** | Dialog closes; the error surfaces as an error toast, never silently. A failing mutation has already been toasted by the global `MutationCache.onError`, so the provider reuses a fixed toast id and the second call replaces the first rather than stacking two. |

Interactions:

| Trigger | Result |
|---|---|
| Click confirm | `onConfirm` runs; async → pending state until it settles |
| Click cancel | `onCancel` runs, dialog closes, promise resolves `false` |
| `Esc` | Same as cancel — **blocked while pending** (`onEscapeKeyDown` preventDefault) |
| Click the overlay | Same as cancel — **blocked while pending** (`onPointerDownOutside` preventDefault) |
| Click confirm twice | Impossible — the button is disabled from the first click until the work settles |

The two pending guards exist for one reason: without them the user dismisses the dialog mid-delete and believes the action was cancelled.

Measurements:

| | Desktop | Mobile |
|---|---|---|
| overlay | `--foreground` at 45%, copied from `sheet.tsx` | same |
| width | 440px max, centred | fills the 16px gutters — `max-width: 440px` already exceeds 390−32, so no mobile rule is needed |
| surface | `--popover`, 1px `--border`, radius 14px | same |
| padding | 22px sides/top, 18px bottom | 20px / 16px bottom |
| title | 16px / 600 | same |
| description | 13px / 400 / `--muted-foreground`, 7px below the title | same |
| icon | 28px, `var(--tone)` fill, `--popover` knockout, 14px to the text, top-aligned | same |
| actions | right-aligned, 8px gap, 22px above | side by side, **not stacked** — two short labels fit 358px, and stacking would put the destructive action under the thumb's resting spot |
| buttons | `<Button>` default size — h-9/36px, px-4, radius 8px, 14px/500 | same |
| focus ring | `--ring` at 50%, 3px — `button.tsx`'s own style | same |

## Components

Existing, reuse as-is:

- `frontend/components/ui/button.tsx:Button` — every button in the dialog. Cancel is `variant="outline"`, confirm is `variant="default"` or `variant="destructive"`, both at the default size. **Do not hand-roll a button in the confirm provider.**
- `frontend/components/ui/sheet.tsx` — read it for the overlay recipe (`bg-foreground/45` + the `data-[state]` animation classes); the new `alert-dialog.tsx` matches it so the two overlays behave the same.
- `frontend/lib/utils.ts:cn` — every conditional class.
- `lucide-react` (already a dependency) — `CircleCheck`, `Info`, `TriangleAlert`, `CircleX`, `CircleHelp`, `X`, `Loader2`. **The mockups draw flat solid versions**: the lucide outline glyph is not what ships — the shipped icon is a solid tone-filled shape with the glyph knocked out in `--popover`, so either pass `fill`/`className` accordingly or inline the 5 small SVGs in the sonner wrapper and the confirm provider. Decide in `design.md`; the visual result must match the mockups.

To add by hand — **the shadcn CLI hangs in this repo** (`devspec/context/rules.md`), so copy the source from ui.shadcn.com into `frontend/components/ui/` by hand; the radix dependency is already covered by the installed `radix-ui` umbrella:

- `alert-dialog.tsx` — `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`. Import shape is `import { AlertDialog as AlertDialogPrimitive } from "radix-ui"` — the umbrella exports namespace objects, not named components (see `sheet.tsx`, `tooltip.tsx`).

New dependency: `sonner` (`pnpm add sonner`). Its `<Toaster>` is wrapped, never used raw.
