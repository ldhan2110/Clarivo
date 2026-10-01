# Tasks: add-feedback-layer

All work is in `frontend/`. No backend file, entity, migration, endpoint or env var is touched, so
`pnpm api:types` is never run. `@/*` resolves from the frontend root (`frontend/CLAUDE.md`) — not from
`app/`, whatever `devspec/context/conventions.md` still says.

## 1. Dependency and theme tones [req-1]
- [x] 1.1 [frontend] `cd frontend && pnpm add sonner` — the only new dependency in this change
- [x] 1.2 [frontend] `app/globals.css`: add `--success: oklch(0.58 0.14 157)` and `--warning: oklch(0.70 0.15 75)` to `:root`, beside `--destructive`
- [x] 1.3 [frontend] `app/globals.css`: add `--success: oklch(0.72 0.16 157)` and `--warning: oklch(0.80 0.15 80)` to `.dark`
- [x] 1.4 [frontend] `app/globals.css`: map both in `@theme inline` — `--color-success: var(--success)`, `--color-warning: var(--warning)` — so `text-success` / `text-warning` resolve
- [x] 1.5 [frontend] Add no other token: no `--info`, no `--success-foreground`, no `--warning-foreground` (`design.md` → Rejected approaches)
Verify: `cd frontend && npx tsc --noEmit && pnpm build` — and `grep -c "success" app/globals.css` shows the three declarations plus the `@theme inline` line

## 2. Tone icons [req-2] [req-8]
- [x] 2.1 [frontend] New `components/ui/tone-icon.tsx` — `<ToneIcon tone size>` for the five tones `confirm | success | info | warning | error`, each a solid `currentColor`-filled shape with the glyph knocked out using `stroke: var(--popover)`
- [x] 2.2 [frontend] Copy the five SVG bodies verbatim from `mockups/toast-stack.html` and `mockups/confirm-dialog.html` — do **not** substitute a lucide outline glyph; `lucide-react`'s stroked icons cannot produce the approved knockout look (`design.md` → Decision Defaults)
- [x] 2.3 [frontend] Colour comes from the caller via `--tone` / a `className`, so the same component serves the toast (26px) and the dialog (28px)
Verify: `cd frontend && npx tsc --noEmit && npx eslint components/ui/tone-icon.tsx`

## 3. Toast wrapper and mount [req-2] [req-3] [req-13]
- [x] 3.1 [frontend] New `components/ui/sonner.tsx` — `"use client"`, wraps sonner's `<Toaster>`; export it as `Toaster`
- [x] 3.2 [frontend] Style it through `toastOptions.classNames` using Tailwind semantic tokens only: `bg-popover text-popover-foreground border border-border` for `toast`, `text-muted-foreground` for `description`, 12px radius, 364px width, 14px padding — matching `components/ui/dropdown-menu.tsx`'s surface
- [x] 3.3 [frontend] Pass the tone icons via `<Toaster icons={{ success: <ToneIcon tone="success"/>, info: …, warning: …, error: … }} />`
- [x] 3.4 [frontend] **No `theme` prop and no `richColors`** — the classNames already follow the `.dark` class, and `theme` would read the OS preference the app does not use
- [x] 3.5 [frontend] Placement: `position="top-right"`, `duration={4000}`, `visibleToasts={3}`, `offset={16}`, `mobileOffset={{ top: 66, left: 16, right: 16 }}` — 66px clears the 58px mobile app bar by 8px
- [x] 3.6 [frontend] `app/layout.tsx`: render `<Toaster />` as the last child of `<body>`, outside the providers
- [x] 3.7 [frontend] Do **not** add a `hooks/use-toast.ts` — `toast` imports from `sonner` directly at every call site
Verify: `cd frontend && npx tsc --noEmit && npx eslint components/ui/sonner.tsx app/layout.tsx && pnpm build`

## 4. API error messages and the global mutation toast [req-4] [req-5]
- [x] 4.1 [frontend] New `lib/api-error.ts` — `apiErrorMessage(error: unknown): string`, reading the backend envelope `{statusCode, code, message, details?}` off an Axios error response (`devspec/context/patterns.md`)
- [x] 4.2 [frontend] Mapping: 4xx with an envelope `message` → that message; 5xx → the generic `"Something went wrong. Please try again."`, never the body; non-Axios throw → the generic string, never `error.message`
- [x] 4.3 [frontend] Leave `hooks/use-auth.ts:authErrorMessage` alone — the login 401 stays deliberately generic; the two functions coexist on purpose (`design.md` → Open questions)
- [x] 4.4 [frontend] `components/provider/query-provider.tsx`: pass `mutationCache: new MutationCache({ onError })` to the existing `new QueryClient({...})`, leaving `defaultOptions.queries` (`staleTime: 60_000`, `refetchOnWindowFocus: false`) untouched
- [x] 4.5 [frontend] The handler is `(error, _vars, _ctx, mutation) => { if (mutation.options.onError) return; toast.error(apiErrorMessage(error)); }` — React Query runs cache-level and mutation-level handlers both, so this check is what makes a local `onError` an override
- [x] 4.6 [frontend] Add a comment above the check naming the trade: a mutation defining `onError` for an unrelated reason (optimistic rollback) loses its error toast, and the fix at that call site is one `toast.error(apiErrorMessage(error))` line
- [x] 4.7 [frontend] Do **not** wire `QueryCache.onError` — a failed background refetch must not toast
Verify: `cd frontend && npx tsc --noEmit && npx eslint lib/api-error.ts components/provider/query-provider.tsx && pnpm build`

## 5. AlertDialog primitive [req-8]
- [x] 5.1 [frontend] New `components/ui/alert-dialog.tsx`, hand-copied from ui.shadcn.com — **the shadcn CLI hangs in this repo** (`devspec/context/rules.md`)
- [x] 5.2 [frontend] Import shape is `import { AlertDialog as AlertDialogPrimitive } from "radix-ui"` — the installed umbrella exports namespace objects, not named components; copy the pattern from `components/ui/sheet.tsx` and `components/ui/tooltip.tsx`
- [x] 5.3 [frontend] Export `AlertDialog`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`; no `AlertDialogTrigger` is needed by this change (the provider drives `open` itself) but keep it if the copied source ships it
- [x] 5.4 [frontend] Overlay reuses `sheet.tsx`'s recipe verbatim — `bg-foreground/45` plus its `data-[state=open]`/`data-[state=closed]` animation classes — so the two overlays behave identically
- [x] 5.5 [frontend] Content: `--popover` surface, 1px `--border`, radius 14px, 440px max width, 22px/18px padding, centred
Verify: `cd frontend && npx tsc --noEmit && npx eslint components/ui/alert-dialog.tsx`

## 6. Confirm type, preset, provider and hook [req-6] [req-7] [req-8] [req-9]
- [x] 6.1 [frontend] New `types/confirm.ts` — `ConfirmTone = "confirm" | "success" | "info" | "warning" | "error"` and `ConfirmOptions = { title; description?; confirmLabel?; cancelLabel?; tone?: ConfirmTone; onConfirm?: () => void | Promise<void>; onCancel?: () => void }`
- [x] 6.2 [frontend] New `constants/confirm.ts` — `confirmDelete(entity: string, name?: string): ConfirmOptions` returning title `Delete ${entity}?`, a description that names `name` when given and always says it cannot be undone, `confirmLabel: "Delete"`, `tone: "error"`. Add no other preset
- [x] 6.3 [frontend] New `components/provider/confirm-provider.tsx` — `"use client"`, mounts exactly one `<AlertDialog>` and provides `confirm(options) => Promise<boolean>` through a context
- [x] 6.4 [frontend] Render with `ToneIcon` at 28px top-aligned to the title, 14px gap; title 16px/600; description 13px `--muted-foreground`; actions right-aligned with 8px gap
- [x] 6.5 [frontend] Buttons are `components/ui/button.tsx:Button` — cancel `variant="outline"`, confirm `variant="destructive"` when `tone === "error"` else `variant="default"`, both default size. Do not hand-roll a button
- [x] 6.6 [frontend] Confirm flow: run `onConfirm`, `await` it, resolve the promise `true`, close. Cancel flow: run `onCancel`, resolve `false`, close
- [x] 6.7 [frontend] Pending state: while an awaited `onConfirm` is unsettled keep the dialog open, set both buttons `disabled`, show a `Loader2` spinner on the confirm button, and leave the label unchanged — there is no `pendingLabel`
- [x] 6.8 [frontend] Pending guards: `onEscapeKeyDown` and `onPointerDownOutside` both `preventDefault()` while pending, so the dialog cannot be dismissed mid-work
- [x] 6.9 [frontend] A rejected `onConfirm` closes the dialog, resolves `false`, and raises `toast.error(apiErrorMessage(error))` with a module-constant id (`"confirm-error"`) so it replaces rather than stacks on an already-toasted mutation error
- [x] 6.10 [frontend] A `confirm()` call while a dialog is open replaces it: the first promise resolves `false` and the first `onCancel` does not fire. No queue
- [x] 6.11 [frontend] New `hooks/use-confirm.ts` — `useConfirm()` reads the context and throws a clear error when called outside the provider
Verify: `cd frontend && npx tsc --noEmit && npx eslint types/confirm.ts constants/confirm.ts components/provider/confirm-provider.tsx hooks/use-confirm.ts`

## 7. Mount the confirm provider [req-6]
- [x] 7.1 [frontend] `app/layout.tsx`: nest as `QueryProvider` → `AuthProvider` → `ConfirmProvider` → `{children}`, with `<Toaster />` still the last child of `<body>`
Verify: `cd frontend && npx tsc --noEmit && pnpm build`

## 8. Auth flows: one report each, confirmed sign-out [req-10] [req-11]
- [x] 8.1 [frontend] `hooks/use-auth.ts` `useLogin`: add `onError: () => {}` with a comment saying the login form renders the 401 inline via `errors.root`, and that defining `onError` at all stands the global toast down
- [x] 8.2 [frontend] `hooks/use-auth.ts` `useLogout`: add the same no-op `onError` — the cookie is gone either way and the user is already being redirected, so an error toast is noise
- [x] 8.3 [frontend] `components/sidebar/nav-user.tsx:83`: replace `onSelect={() => logout.mutate()}` with a `confirm()` call — title `Sign out?`, description `You'll need to sign in again to get back to your projects.`, `confirmLabel: "Sign out"`, `tone: "error"`, `onConfirm: () => logout.mutateAsync()`
- [x] 8.4 [frontend] Raise the success toast from the confirm's resolution, not from `useLogout` — `useLogout.onSettled` already clears the store and redirects, and a toast belongs to the action, not the hook
- [x] 8.5 [frontend] Leave `logout.isPending` on the menu item's `disabled`; if focus visibly fights between the closing dropdown and the opening dialog, add `e.preventDefault()` in `onSelect` (`design.md` → Decision Defaults)
Verify: `cd frontend && npx tsc --noEmit && npx eslint hooks/use-auth.ts components/sidebar/nav-user.tsx && pnpm build`

## 9. Demo card [req-12]
- [x] 9.1 [frontend] `app/(app)/page.tsx`: add a `<Card>` at the bottom of the dashboard with buttons raising each of the four tones, every one with a title and a description
- [x] 9.2 [frontend] Add one button opening a `confirmDelete("project", "Clarivo API v2")` dialog whose `onConfirm` waits ~1.2s before resolving, so the pending state is exercisable by hand
- [x] 9.3 [frontend] Add one button whose `onConfirm` rejects, so the failure path and the shared toast id are exercisable
- [x] 9.4 [frontend] Reuse `components/ui/card.tsx:Card` / `CardHeader` / `CardTitle` / `CardContent` and `components/ui/button.tsx:Button` — no new styling
- [x] 9.5 [frontend] Mark the whole card `// ponytail: demo — delete when real screens land`
Verify: `cd frontend && npx tsc --noEmit && npx eslint "app/(app)/page.tsx" && pnpm build`

## 10. Prove it in the browser [req-3] [req-7] [req-12] [req-13]
- [x] 10.1 [frontend] Run the app (`pnpm dev` on :3001, backend on :3000) and sign in
- [x] 10.2 [frontend] Desktop ≥1280px: raise each tone from the demo card; measure that the toast sits 16px from the top and right and is 364px wide, that the surface is `--popover` and the icon carries the tone, and that a fourth toast never makes a fourth mount
- [x] 10.3 [frontend] 390px: measure the toast's top offset is 66px and that it covers neither the hamburger nor the bell; confirm the dialog fills the 16px gutters with its buttons side by side
- [x] 10.4 [frontend] Exercise the pending state: confirm the slow demo action, and check the dialog stays open, both buttons are disabled, `Esc` does nothing, and an overlay click does nothing
- [x] 10.5 [frontend] Exercise the failure path: confirm the rejecting demo action, and check the dialog closes and exactly one error toast appears
- [x] 10.6 [frontend] Sign-out: cancel it (no request fires, user stays), then confirm it (redirect to `/login` plus a success toast)
- [x] 10.7 [frontend] Bad login: check the 401 shows once inline and raises no toast
- [x] 10.8 [frontend] Dark pass: set `class="dark"` on `<html>` in devtools and repeat the tone sweep and one dialog; check the computed styles are the `.dark` token values and the destructive button renders at the `dark:bg-destructive/60` weight
- [x] 10.9 [frontend] Save baseline screenshots of both themes, both breakpoints, under `devspec/changes/add-feedback-layer/verify/`
Verify: `/devspec-verify add-feedback-layer` — agent-browser drives the running app and reports the measured offsets, computed token colours, stack cap and pending-guard behaviour against `ui.md`

## 11. Gates [req-1] … [req-13]
- [x] 11.1 [frontend] `cd frontend && npx tsc --noEmit` clean
- [x] 11.2 [frontend] `cd frontend && pnpm lint` clean, warnings included
- [x] 11.3 [frontend] `cd frontend && pnpm build` succeeds
- [x] 11.4 [frontend] `git status` shows no stray file: no `use-toast.ts`, no new token beyond `--success`/`--warning`, nothing under `types/api/`
Verify: `cd frontend && npx tsc --noEmit && pnpm lint && pnpm build`
