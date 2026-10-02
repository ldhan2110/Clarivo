# UI: add-profile

**Mockups**: `mockups/profile.html` (approved 2026-10-02 by LE AN)
**References**: no external image; sibling of the existing confirm/alert dialogs and the auth forms. Entry point is the existing `components/sidebar/nav-user.tsx` dropdown.
**Style source**: tokens copied verbatim from `frontend/app/globals.css` `:root` (`--primary`, `--border`, `--input`, `--muted-foreground`, `--destructive`, `--chart-1/3`, `--radius`); component shapes mirror `components/ui/dialog.tsx`, `input.tsx`, `button.tsx`, `avatar.tsx`.

## Entry point — nav-user dropdown
`components/sidebar/nav-user.tsx` currently renders a **disabled** `DropdownMenuItem` labelled "Profile" with a "Soon" badge. Replace it with **one live "Profile" item** that opens the Profile modal. Sign-out item unchanged. The trigger avatar also gains an image: when `user.avatarFileId` is set, render `<AvatarImage src={`/api/files/${user.avatarFileId}`}/>` inside the existing `<Avatar>`, keeping `initialsOf(user.name)` as the `<AvatarFallback>`.

## Profile modal (single modal, two sections)
One `<Dialog>` titled **Profile**, description "Manage your photo, name and password." Two stacked sections separated by a divider; **each section owns its own submit**.

Layout:
```
┌─ Profile ───────────────────────────────── ✕ ┐
│ Manage your photo, name and password.         │
│                                               │
│ PHOTO & NAME                                  │
│  ┌────┐  [ Upload photo ]                      │
│  │ AL │  PNG, JPG, WebP or GIF · max 5 MB      │
│  └────┘                                        │
│  Display name                                 │
│  [ An Le___________________________ ]  5/255   │
│                                     [ Save ]   │
│ ───────────────────────────────────────────── │
│ CHANGE PASSWORD                               │
│  Current password  [ ········__________ ]      │
│  New password      [ ··················  ]      │
│  Confirm new pass. [ ··················  ]      │
│                              [ Update password]│
└───────────────────────────────────────────────┘
```

### Section 1 — Photo & name
- **Avatar**: 72px rounded tile. Shows `<AvatarImage>` of the current avatar when set, else the gradient initials fallback (`from-chart-3 to-chart-1`, as nav-user uses). "Upload photo" button triggers a hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">`.
- **Avatar persists on pick (upload-on-pick)** — not on Save. On file choose: validate client-side (≤5 MB, image type), show local preview, immediately `PATCH /users/me/avatar` (multipart). While in flight the button reads "Uploading…" (disabled) with a two-div progress bar (no progress primitive in repo — design.md). On success the store user is refreshed so the nav avatar updates everywhere.
- **Display name**: `<Input>` bound via react-hook-form + zod (`name` required, ≤255). Character counter. "Save" submits `PATCH /users/me` `{name}`; disabled while invalid or pending (spinner "Saving…").

### Section 2 — Change password
- Three `<Input type="password">`: current, new, confirm. react-hook-form + zod: `currentPassword` required; `newPassword` ≥8; `confirm` must equal `newPassword` (zod `.refine`).
- "Update password" submits `POST /users/me/password` `{currentPassword, newPassword}`; disabled while invalid or pending (spinner "Updating…").
- **Wrong current password** → 401 surfaces as an **inline banner inside this section** (red, above the fields), NOT a global toast — this mutation defines its own `onError`, which also stands down the global MutationCache toast (`components/provider/query-provider.tsx`, same mechanism as `useLogin`).
- **Success** → global success toast "Password updated" (default MutationCache path); the three fields reset to empty.

## States (all in the mockup, scroll to see)
| state | shows |
|---|---|
| A default | both sections, avatar = initials fallback, name prefilled |
| B uploading | avatar preview + progress bar, upload button disabled |
| C client validation | avatar >5 MB inline error; name required; new-pw too short; confirm mismatch; submits disabled |
| D wrong current pw | red banner in password section + "Updating…" spinner |
| E success | password fields cleared, success note, toast |

## Components to reuse (real `path:symbol`)
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` — `components/ui/dialog.tsx`
- `Input` — `components/ui/input.tsx` · `Label` — `components/ui/label.tsx` · `Button` — `components/ui/button.tsx`
- `Avatar`, `AvatarImage`, `AvatarFallback` — `components/ui/avatar.tsx` (AvatarImage already exported, currently unused)
- `DropdownMenuItem` — `components/ui/dropdown-menu.tsx` (the entry point in `nav-user.tsx`)
- `initialsOf(name)` — `components/sidebar/nav-user.tsx` (exported; reuse for fallback)
- Toasts: existing `sonner` + global MutationCache (`components/provider/query-provider.tsx`)

No new UI primitive is copied — every piece exists. The file input, progress bar (two divs) and the modal wiring are the only new markup.

## Verify hook (for tasks.md)
`Verify: /devspec-verify add-profile` — agent-browser on the running app: open the Profile modal from nav-user, assert both sections render with real (non-plain) styling, name save round-trips, avatar preview appears on pick, password mismatch blocks submit, wrong current password shows the inline banner.
