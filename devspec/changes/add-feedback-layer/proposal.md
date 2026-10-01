_approved_by: LE AN_
_approved_at: 2026-10-01_

# Proposal: add-feedback-layer

## Why

The app has no way to tell the user that anything happened. Every outcome today is
either silent or hand-wired: the login form renders its own 401 inline via
`setError("root")`, and `useLogout` just navigates away. Nothing confirms a
destructive action before it runs, and nothing reports a failure that isn't part
of a form.

Clarivo's MVP screens are full of actions that need both — creating a project,
uploading context documents, generating a meeting plan, deleting a requirement.
Each of those will otherwise invent its own feedback, and the result is fifteen
screens that each report success differently.

This change lands the feedback layer once, as reusable scaffold, before the
screens that need it exist.

## What it delivers

**Toasts** — four tones (success, info, warning, error), each with a title and an
optional description, stacked top-right. Built on `sonner`, styled from the
project's own OKLCH semantic tokens so a toast matches the sidebar and cards it
appears over, in both light and dark.

**Global error reporting** — a failed mutation produces an error toast
automatically, with no per-call wiring. A mutation that defines its own `onError`
stands the global toast down, so a form keeps owning its inline error.

**Confirm dialogs** — one `confirm()` call, available anywhere, that returns a
promise *and* fires `onConfirm` / `onCancel` callbacks. Built on Radix
`AlertDialog`, mounted once. An async `onConfirm` keeps the dialog open with a
disabled, spinning confirm button until the work resolves, so a slow delete can't
be double-submitted or dismissed mid-flight.

**One preset** — `confirmDelete(entity, name?)`, so every delete dialog in the app
reads the same.

## Scope

**In**
- `sonner` added as a dependency; its `<Toaster>` wrapper hand-written against our tokens.
- `--success` and `--warning` added to the theme (`:root`, `.dark`, `@theme inline`).
- `components/ui/alert-dialog.tsx` hand-copied from the installed `radix-ui` umbrella.
- A confirm provider + `useConfirm` hook + `ConfirmOptions` type + `confirmDelete` preset.
- `lib/api-error.ts` — the backend error envelope rendered as a human message.
- `MutationCache.onError` wired into the existing `query-provider.tsx`.
- `<Toaster>` and `<ConfirmProvider>` mounted in `app/layout.tsx`.
- Sign-out routed through a confirm dialog + success toast — the one real action that exists today.
- A temporary demo card on the dashboard, firing all four tones and a confirm, so the
  tones can be reviewed side by side. Marked for deletion once real screens land.

**Out**
- A persistent notification centre (bell, unread count, history). That needs a table,
  an entity and endpoints, and the backend has no domain entities yet. Separate change.
- A theme toggle. `.dark` exists as a class but nothing sets it; the toasts are built
  to follow it the day something does.
- A `useToast` hook. `sonner`'s `toast` is importable anywhere — a wrapper would be an
  abstraction with a single implementation.
- Global *success* toasts. The right success message is always feature-specific, so it
  stays an explicit `onSuccess` per mutation.
- Cancel-reason discrimination, typed confirmation ("type the name to delete"), and
  stacked confirms. None has a screen that needs it.
- Any backend work. No entity, migration, endpoint, env var or DTO is touched.

## Cost

Roughly 300 lines across ten files, one new dependency. Two shared files are
touched — `query-provider.tsx` and `app/layout.tsx` — plus one edit to shipped code
in `hooks/use-auth.ts` so the login 401 doesn't report twice.
