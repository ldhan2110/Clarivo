# Design: add-feedback-layer

## Chosen approach

Two independent surfaces, one shared idea: **feedback is infrastructure, not per-screen code**. A screen says *what* happened; the layer decides *how* it looks.

### Toasts — `sonner`, wrapped

`sonner` is a new dependency. The alternative was hand-rolling on the `Toast` primitive of the already-installed `radix-ui` umbrella, which is normally the right call here (`rules.md`: prefer what's installed). It was rejected because the hand-rolled version is not small: stacking, swipe-dismiss, hover-pause, timer management and the `aria-live` behaviour add up to ~150 lines of timer and gesture code written from scratch, against ~20 lines to wrap a library that does all of it. Writing an accessibility-sensitive timer loop by hand to avoid one 15 kB dependency is a bad trade.

What is *not* taken from sonner is its look. No `theme` prop, no `richColors`:

- `richColors` floods the whole toast with the tone colour, which stops matching `--popover`-based surfaces the moment the app has a dark theme.
- The `theme` prop reads the OS preference. The app's dark mode is the `.dark` class, which nothing currently sets — so `theme="system"` would put a dark toast on a light app.

Instead the wrapper passes `toastOptions.classNames` built from Tailwind semantic tokens. The toast inherits `.dark` the same way every other component does, and matches `dropdown-menu.tsx` exactly because it uses the same three tokens.

### Global error reporting — `MutationCache.onError`

Error toasts are wired once at the `QueryClient`, not at call sites:

```ts
new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      toast.error(apiErrorMessage(error));
    },
  }),
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
})
```

The `mutation.options.onError` check is the override mechanism. React Query runs cache-level *and* mutation-level handlers — they do not replace each other — so without this check a mutation with its own handling would report twice. With it, **defining `onError` on a mutation stands the global toast down**, which is the whole configuration surface: no `meta` flags, no opt-out registry, nothing to remember.

Its cost is named up front: a mutation that defines `onError` for an *unrelated* reason — rolling back an optimistic update, say — silently loses its error toast. The fix at that call site is one `toast.error(apiErrorMessage(error))` line. This is a deliberate trade of a rare silent gap for zero configuration everywhere else.

**Queries are not wired.** A background refetch failing must not pop a toast; a query renders its own error state inline. Only mutations — things the user explicitly did — report this way.

**Success is never global.** The right success message is always feature-specific, so it stays an explicit `onSuccess: () => toast.success(…)`. A `meta.successMessage` sugar was considered and dropped: it buys three lines of declarativeness and adds a second way to do the same thing.

### Confirm — one mounted dialog, imperative API

`ConfirmProvider` mounts exactly one Radix `AlertDialog` for the whole app and hands out an imperative `confirm()` through context. Call sites get no JSX, no local `useState`, no per-screen dialog.

One function serves all three ergonomics, because the callbacks and the promise are not alternatives:

```ts
// callback — the standard
confirm({ ...confirmDelete("project", p.name), onConfirm: () => remove.mutateAsync(p.id) });
// promise — when the page branches after
if (await confirm({ title: "Discard draft?" })) router.back();
// both
if (await confirm({ title: "Archive?", onConfirm: archive })) toast.success("Archived");
```

**The dialog owns the pending state.** When `onConfirm` returns a promise the dialog stays open with both buttons disabled and a spinner on confirm, and `Esc` / overlay-click are blocked. Closing immediately and letting the page show its own spinner was the first instinct and is wrong once callbacks exist: the dialog would vanish while the work runs, the button could be clicked twice, and a user who pressed `Esc` mid-delete would believe it was cancelled.

`tone` is the same vocabulary as the toast — `confirm` · `success` · `info` · `warning` · `error` — and drives two things only: the icon and whether the confirm button is `destructive`. `error` is the only tone that changes the button.

## Architecture

```
  any component / hook
         │
         │  toast.success("…", { description })         confirm({ …, onConfirm })
         │  toast.error / .info / .warning                     │
         ▼                                                     ▼
  sonner `toast`                                        useConfirm()  ──▶ ConfirmContext
         │                                                     │
         ▼                                                     ▼
  <Toaster>  (components/ui/sonner.tsx)            <ConfirmProvider>  (components/provider/)
  token classNames + ToneIcon                      one <AlertDialog>, open/pending state
         │                                                     │
         └──────────────── app/layout.tsx ◀────────────────────┘


  mutation fails
         │
         ▼
  MutationCache.onError  (components/provider/query-provider.tsx)
         │
         ├── mutation.options.onError defined? ──▶ stand down, the call site owns it
         │
         └── otherwise ──▶ apiErrorMessage(error)  (lib/api-error.ts)
                                   │
                                   ▼
                           toast.error(message)
```

Flow for a confirmed destructive action:

```
click ─▶ confirm({tone:"error", onConfirm}) ─▶ dialog opens, focus on Confirm
      ─▶ click Confirm ─▶ pending (buttons disabled, Esc/overlay blocked)
      ─▶ onConfirm resolves ─▶ dialog closes ─▶ promise true ─▶ caller's onSuccess toasts
      ─▶ onConfirm throws   ─▶ dialog closes ─▶ promise false ─▶ error toast (fixed id)
```

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|---|---|---|
| Tone icons: lucide components or inline SVG? | **Inline SVG**, in one shared `components/ui/tone-icon.tsx` exporting `<ToneIcon tone>`. lucide glyphs are stroke-outline; the approved look is a solid tone fill with the glyph knocked out in `--popover`, which an outline glyph cannot produce. Copy the five SVGs verbatim from `mockups/toast-stack.html` / `confirm-dialog.html`. | If a lucide icon can be made to match (`fill="currentColor"` + a knockout path), use lucide and delete `tone-icon.tsx` |
| Two consumers for `ToneIcon` — is a shared file justified? | Yes. The toast wrapper and the confirm provider both need the same five icons; this is deduplication, not speculation | — |
| How the Toaster gets the icons | `<Toaster icons={{ success: …, info: …, warning: …, error: … }} />` | If the installed sonner version lacks `icons`, render them through `toastOptions.classNames` + a CSS mask, or pass `icon` per `toast()` call from a small local helper |
| Mobile 66px top offset | `<Toaster offset={16} mobileOffset={{ top: 66, left: 16, right: 16 }} />` | If the installed sonner lacks `mobileOffset`, set it in `globals.css` on `[data-sonner-toaster]` inside a `@media (max-width: 767px)` block |
| `apiErrorMessage` for a 5xx | Return the generic `"Something went wrong. Please try again."` — never the server's message. `AppExceptionFilter` already replaces 5xx messages with `'Internal server error'` (`rules.md`), which is not user copy | — |
| `apiErrorMessage` for a 4xx | Use the envelope's `message` when present; fall back to the generic string. The envelope is `{statusCode, code, message, details?}` (`patterns.md`) | For a 401 outside the login form, `"Your session has expired. Please sign in again."` |
| `apiErrorMessage` for a non-axios throw | Generic string. Never render `error.message` from an unknown throw | — |
| Toast id for a confirm failure | A module constant, `CONFIRM_ERROR_TOAST_ID = "confirm-error"`, passed as `{ id }` so a second toast replaces the first instead of stacking on an already-toasted mutation error | — |
| `confirm()` called while a dialog is already open | The new call replaces the open one; the first promise resolves `false` and its `onCancel` does **not** fire (the user didn't cancel — the app moved on). No queue | If a real screen needs stacking, that's a new change |
| Provider nesting order in `app/layout.tsx` | `QueryProvider` → `AuthProvider` → `ConfirmProvider` → children, with `<Toaster />` as the last child of `<body>`, outside the providers | — |
| Opening the dialog from a `DropdownMenuItem` (sign-out) | No `preventDefault` needed — the confirm is imperative, so the menu closes normally and the provider's dialog opens after. | If focus visibly fights between the closing menu and the dialog, `onSelect={(e) => { e.preventDefault(); confirm(…); }}` |
| `useLogin` would now report a 401 twice | Add `onError: () => {}` to the mutation in `hooks/use-auth.ts` with a comment naming why — the login form renders the 401 inline via `errors.root`, and defining `onError` at all stands the global toast down | — |
| `useLogout` has `onSettled` but no `onError` | Add the same no-op `onError`. The cookie is gone either way and the user is already being redirected to `/login`; an error toast there is noise | — |
| Where `ConfirmOptions` lives | `types/confirm.ts`, per the layer split established by the last refactor (`types/` for types, `constants/` for values) | — |
| Where `confirmDelete` lives | `constants/confirm.ts` | — |
| Confirm pending label | Does not change. The spinner carries the state; there is no `pendingLabel` option | — |
| Demo card placement | A `<Card>` at the bottom of `app/(app)/page.tsx`, marked `// ponytail: demo — delete when real screens land` | If the dashboard is already crowded, a `app/(app)/_demo/page.tsx` route instead |
| Dark-mode verification with no theme toggle | Set `class="dark"` on `<html>` by hand in devtools for the dark pass. Do **not** add a toggle — out of scope | — |

### Blast Radius

New files — all additive:

```
frontend/components/ui/sonner.tsx                      (new)  — safe/reversible
frontend/components/ui/alert-dialog.tsx                (new)  — safe/reversible
frontend/components/ui/tone-icon.tsx                   (new)  — safe/reversible
frontend/components/provider/confirm-provider.tsx      (new)  — safe/reversible
frontend/hooks/use-confirm.ts                          (new)  — safe/reversible
frontend/types/confirm.ts                              (new)  — safe/reversible
frontend/constants/confirm.ts                          (new)  — safe/reversible
frontend/lib/api-error.ts                              (new)  — safe/reversible
frontend/package.json                                  (+ sonner)  — safe/reversible
```

Existing files touched:

```
frontend/app/globals.css                 (+ --success, --warning in :root, .dark, @theme inline)  — safe/reversible
frontend/app/layout.tsx                  (+ <ConfirmProvider>, + <Toaster />)                     — safe/reversible
frontend/components/provider/query-provider.tsx  (+ mutationCache)                                — safe/reversible
frontend/hooks/use-auth.ts               (+ no-op onError on useLogin and useLogout)               — safe/reversible
frontend/components/sidebar/nav-user.tsx (sign-out routed through confirm + success toast)         — safe/reversible
frontend/app/(app)/page.tsx              (+ temporary demo card)                                   — safe/reversible
```

Reach, resolved by import graph (the frontend is not in the code-review-graph index — `summary.md` — so this is from `grep` over `app/`, `components/`, `hooks/`):

- `query-provider.tsx` has exactly one importer: `app/layout.tsx:4`. Its change is additive — the existing `defaultOptions.queries` block is untouched — so every query in the app keeps its `staleTime: 60_000` / no-refetch-on-focus behaviour.
- `hooks/use-auth.ts` has two consumers: `app/(auth)/login/page.tsx:14` (`useLogin`, `authErrorMessage`) and `components/sidebar/nav-user.tsx:15` (`useLogout`). Both are read and both are accounted for above. `authErrorMessage` keeps its current behaviour and is **not** replaced by `apiErrorMessage` — the login 401 must stay deliberately generic (`frontend/CLAUDE.md`), which is a different rule from "render the envelope message".
- `nav-user.tsx:83` currently calls `logout.mutate()` directly from a `DropdownMenuItem`. That line is the only sign-out in the app — `mobile-nav.tsx` renders nav items only.
- No backend file, entity, migration, endpoint, DTO or env var is touched. `types/api/` is untouched, so `pnpm api:types` does not need to run.

### Risk + reversibility

Every entry above is **safe/reversible**: all additive, no destructive operation, no migration, no security check weakened, no external side effect. The two riskiest lines for a reviewer to read are `query-provider.tsx` (a behaviour change that reaches every mutation in the app) and the two no-op `onError` handlers in `use-auth.ts` (which look like dead code unless the comment explains them) — both are flagged here precisely because a reviewer would otherwise skim them.

## Rejected approaches

| Option | Why not |
|---|---|
| Hand-roll toasts on the installed `radix-ui` `Toast` primitive | ~150 lines of timer/gesture/`aria-live` code versus ~20 to wrap sonner. The dependency is cheap; the hand-rolled a11y is not |
| sonner's `richColors` and `theme` props | `richColors` floods the surface and breaks the match with `--popover` components; `theme` reads the OS preference, which disagrees with the app's `.dark`-class dark mode |
| A `--info` token | `info` reuses `--primary`. A third blue would be noise; the glyph distinguishes `confirm` from `info` |
| `--success-foreground` / `--warning-foreground` | Tone never fills a surface here, so nothing is laid on those colours. Add the pair when a `success` Button variant exists |
| A `useToast` hook wrapping sonner's `toast` | An abstraction with exactly one implementation. `toast` already imports anywhere |
| `meta: { silent: true }` / `meta: { successMessage }` | A second configuration surface next to `onError`/`onSuccess`, which already exist and already express the intent |
| Global toast on query errors too | A background refetch failing would pop a toast the user didn't ask for. Queries render their error inline |
| Dialog closes immediately, page owns the spinner | Breaks as soon as `onConfirm` is async: the dialog vanishes mid-work, the button can be double-clicked, and `Esc` reads as a cancel that didn't happen |
| `confirmDelete` plus `confirmDiscard` / `confirmLeave` / `confirmBulkDelete` | No screen needs them yet. Presets added ahead of their call sites rot |
| Cancel-reason discrimination (`"button" \| "escape" \| "backdrop"`) | Analytics-only; `onCancel` fires the same for all three |
| Typed confirmation ("type the project name to delete") | Real pattern, no screen destructive enough yet |
| A notification centre (bell, unread count, history) | Needs an entity, a table and endpoints. The backend has zero domain entities. Separate change |
| A theme toggle, so dark mode can be verified normally | Out of scope. The toasts are built to follow `.dark`; setting the class by hand is enough to verify |

## Open questions

1. **`conventions.md` is stale for the frontend.** It still documents `@/*` → `./app/*` with everything under `app/`; `frontend/CLAUDE.md` is authoritative (`@/*` resolves from the frontend root, and `components/`, `hooks/`, `types/`, `constants/`, `lib/`, `services/`, `stores/` are top-level). This change follows `frontend/CLAUDE.md`. Refreshing the context pack is a separate job — `/devspec-init`.
2. **The demo card has to be deleted by someone.** It is marked with a `ponytail:` comment, but nothing enforces its removal. It should go in the first change that adds a real screen with real actions.
3. **`authErrorMessage` and `apiErrorMessage` now coexist** in the codebase and do deliberately different things (one keeps a 401 generic for security, one renders the envelope). That is correct but invites a future "cleanup" that would merge them and leak whether an email exists. The comment on `authErrorMessage` already says why it exists; this change does not touch it.
