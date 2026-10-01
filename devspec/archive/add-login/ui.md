# UI: add-login

**Mockup**: `mockups/login.html` — approved 2026-09-30 by LE AN (6 states × 3 widths, open by double-click)
**References**: `assets/ChatGPT Image Sep 30, 2026, 02_57_53 PM.png` panel 1 (original intent) · `~/Desktop/Screenshot 2026-09-30 at 16.35.52.png` (CareOne — the card shape, leading input icons, bold labels, one-line welcome)
**Style source**: every color, radius and dark value copied verbatim from `frontend/app/globals.css` (`--primary`, `--secondary`, `--card`, `--input`, `--ring`, `--destructive`, `--muted-foreground`, and the whole `.dark` block). Nothing invented.
**Assets**: `frontend/public/clarivo-mark.png` (mark only — cropped from `clarivo-logo.png`, which is the *stacked* lockup and cannot sit inline beside a text wordmark) · `frontend/public/login-background.webp` (from `assets/login-background.png`)

## login  →  route `/login`

One card, centred. Mobile-first: the phone layout is the base; `≥900px` splits it into two panels.

```
  PHONE / TABLET  (<900px)              DESKTOP  (>=900px)
  ┌──────────────────────┐    ┌──────────────────┬────────────────────┐
  │ (C) Clarivo          │    │ (C) Clarivo      │ Welcome back —     │
  │ Welcome back —       │    │                  │ sign in to your    │
  │ sign in to your      │    │  ┌────────────┐  │ workspace.         │
  │ workspace.           │    │  │            │  │                    │
  │                      │    │  │   login-   │  │ Email              │
  │ Email                │    │  │ background │  │ [✉  you@exampl..]  │
  │ [✉  you@example.com] │    │  │  centred,  │  │ Password           │
  │ Password             │    │  │ UNcropped  │  │ [🔒 ••••••••   👁] │
  │ [🔒 ••••••••     👁] │    │  │            │  │                    │
  │                      │    │  └────────────┘  │ ☐ Remember   Forgot│
  │ ☐ Remember  Forgot?  │    │                  │ [    Sign in     ] │
  │ [     Sign in      ] │    │                  │ Don't have? Sign up│
  │ Don't have? Sign up  │    └──────────────────┴────────────────────┘
  └──────────────────────┘        48% --secondary      52% form
      max-width 440px                   card max-width 960px
```

**Breakpoints** — `<640` phone · `≥640` same card, more padding, max-width 452px · `≥900` two panels, max-width 960px.

**Brand panel**
- Phone/tablet: **logo only**. No tagline, no feature list, no illustration.
- Desktop: logo above `login-background` at `object-fit: contain`, `border-radius: 14px`, centred on a `--secondary` ground. **Contain, not cover** — the illustration is never cropped.

**States** (all six are rendered in the mockup)
| State | What it looks like |
|-------|--------------------|
| empty | Placeholders only, button enabled |
| filled | Values present, "Remember me" checked |
| submitting | **All inputs, the checkbox and the button disabled**; button shows a spinner + "Signing in…"; the eye toggle is removed |
| auth error | Red alert above the Email field: "Incorrect email or password." Values preserved. Inputs are *not* marked invalid — the failure is not attributable to one field |
| field validation | Per-field red text under the offending input + `aria-invalid="true"` on it. No alert banner. Fires before any request |
| dark | Same screen under `.dark`; the illustration keeps its own colors |

**Interactions**
- Enter submits the form.
- Eye button toggles password visibility; hidden entirely while submitting.
- Success → redirect to `/` (the dashboard route, which does not exist yet — it lands on the existing `app/page.tsx`).
- "Forgot password?" and "Sign up" render but are `href="#"` — neither screen exists in this MVP.
- **No** SSO: Google, Keycloak and the "or continue with" divider are cut from the reference image.

**Touch / mobile rules** (the point of the change — this app is used on phones)
- Inputs and the submit button are **50px** tall (46px at `≥900px`).
- Inputs use `font-size: 16px` — anything smaller and iOS Safari zooms the page on focus.
- The eye toggle is **44×44**; the whole "Remember me" *label* is the tap target at 44px tall, not just the 20px box.
- Bottom padding includes `env(safe-area-inset-bottom)` so the button clears the home indicator.
- `inputmode="email"` on the email field so the phone keyboard shows `@`.
- `autocomplete="email"` / `autocomplete="current-password"` so password managers work.

**Components to reuse** — resolved against the real tree, not assumed:
| Need | Use | Status |
|------|-----|--------|
| Submit button | `frontend/app/components/ui/button.tsx:Button` (`variant="default"`, `size` overridden for the 50/46px height) | **exists** |
| Class merge | `frontend/app/lib/utils.ts:cn` | **exists** — note `button.tsx:3` currently imports `cn` from the `cn` **npm package** instead; see design.md |
| Text input | `components/ui/input.tsx:Input` | **missing — must be added** |
| Field label | `components/ui/label.tsx:Label` | **missing — must be added** |
| Checkbox | `components/ui/checkbox.tsx:Checkbox` | **missing — must be added** |
| Icons | `lucide-react` (`Mail`, `Lock`, `Eye`, `EyeOff`, `AlertCircle`, `Loader2`) | **installed** |

shadcn/ui is the design system (`components.json`: new-york, slate, CSS variables, RSC). **The shadcn CLI hangs in this environment** — the three missing components are copied in by hand from ui.shadcn.com and their radix dep installed with pnpm.

**Asset note**: `assets/login-background.png` is 1536×1024 / **1.4 MB**. It must ship as WebP and must **not** be requested on phones at all — `display:none` still downloads it, so the build skips the request behind a media query or a conditional render.

**Verify**: `/devspec-verify add-login` — agent-browser drives the running app and checks the regions exist, the styling is not browser-default, the layout is aligned, and the screen behaves at 390px as well as at desktop.
