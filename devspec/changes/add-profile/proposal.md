_approved_by: LE AN_
_approved_at: 2026-10-02_

# Proposal: add-profile

## Why
A signed-in user has no way to manage their own account. The nav-user dropdown already shows a disabled "Profile · Soon" placeholder (`components/sidebar/nav-user.tsx`); this change makes it real. Users need to set a display photo, correct their display name, and rotate their password — all from inside the app, since Clarivo has no self-service account surface at all today.

## What it delivers
A single **Profile modal**, opened from the nav-user dropdown, with two sections:
1. **Photo & name** — upload an avatar (persists on pick) and edit the display name.
2. **Change password** — current + new + confirm, verified server-side.

Plus the plumbing that makes an avatar actually display: a nullable `avatar_file_id` on `users`, a nullable `avatarFileId` on the user response shape, and a Next rewrite proxy so an `<img>` can load the (cookie-guarded) file endpoint same-origin.

## Scope — in
- Backend: `users.avatar_file_id` column (migration #5), `UserDto.avatarFileId` exposed, a new `profile/` module with `@Controller('users/me')` exposing `PATCH /users/me` (name), `POST /users/me/password`, `PATCH /users/me/avatar` (multipart, 5 MB, images only).
- A password helper (`hashPassword`/`verifyPassword`) — this is the first place the app hashes a password (seed hashes externally today).
- Frontend: the Profile modal (two sections, react-hook-form + zod), nav-user wiring (live item + avatar image), `services/users.ts`, `hooks/use-profile.ts`, a `/api/files/:id` rewrite in `next.config.ts`, regenerated API types.

## Scope — out
- **No profile page/route** — a modal only (user decision).
- **No role field** — nav-user keeps its hardcoded "BA" (its existing `ponytail:` note stands).
- **No email change** — email is the login identity and unique; changing it is a separate concern.
- **No avatar resize/crop/EXIF handling** — store the uploaded image as-is within the 5 MB cap.
- **No cleanup of replaced avatar files** — replacing an avatar orphans the previous `files` row. `files` has no delete path and `uploaded_by` is ON DELETE RESTRICT; orphans accumulate, matching the repo's accepted "rejected blocks accumulate forever" precedent (`add-project-context`). Flagged, not built.
- **No other-session invalidation on password change** — JWT is a stateless cookie with no revocation list; a changed password does not kill existing sessions. Flagged.

## Dependencies
`depends_on: []`. Everything consumed — the `users` table and `JwtAuthGuard`/`SESSION_COOKIE` (add-login), `FilesService` + the `files` table + multer config (add-file-storage), the global MutationCache toast + confirm provider (add-feedback-layer), the nav-user dropdown (add-app-shell) — is already built, verified, and in the working tree.
