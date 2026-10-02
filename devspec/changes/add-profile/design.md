# Design: add-profile

## Chosen approach

Three independent writes behind one modal. The modal is pure presentation; the backend exposes three small, orthogonal endpoints under a `/users/me` prefix. The read path is untouched — the store still hydrates from `GET /auth/me`, which now also carries `avatarFileId`.

### Why a new `profile/` module, not `UsersController` in `UsersModule`
The avatar endpoint needs multer + `FilesService`, so its module must import `FilesModule`. But the import graph is already:

```
FilesModule → ProjectsModule → UsersModule
```

so `UsersModule → FilesModule` would close a cycle (`Users → Files → Projects → Users`), forcing `forwardRef` — which NestJS's own docs call a smell. A new leaf module sidesteps it entirely:

```
ProfileModule ─┬→ UsersModule   (read/write user rows)
               └→ FilesModule   (FilesService + the exported MulterModule config)
```

`UsersModule` stays a leaf that everything imports. The controller path string `@Controller('users/me')` is independent of the module/class name, so the routes still live at `/users/me` as intended.

### Why `AuthService.validate` is not touched
Password change needs `argon2.hash` (new to the app) and a verify of the current password. `AuthService.validate` already verifies, but it is the credential path with an oracle test (`auth.service.spec` asserts unknown-email == bad-password, identical error). Making it delegate would edit that security-sensitive code and its mocks. Instead a tiny `password.ts` helper (`hashPassword`/`verifyPassword` wrapping argon2id) is introduced and used **only** by the new password-change path. `validate` stays byte-for-byte. Cost: `argon2.verify` is called in two places — cheap, and it keeps the auth oracle untouched. (A later refactor to route `validate` through the helper is optional and out of scope.)

### Why the avatar endpoint gets its own limit
`FilesModule` re-exports `MulterModule` specifically so an importing module's `FileInterceptor` resolves the shared `diskStorage` config (its comment says so). The avatar endpoint reuses that storage but overrides the per-request limit and filter inline: `FileInterceptor('file', { limits: { fileSize: 5 MB }, fileFilter: <png/jpeg/webp/gif only> })`. `storage` stays shared; `limits`/`fileFilter` override per-key. Avatar gets a 5 MB image-only gate without touching the 100 MB global default.

### Why the Next rewrite proxy
The file download endpoint (`GET /files/:id`) is cookie-guarded by `JwtAuthGuard`. An `<img src="http://localhost:3000/files/:id">` from the `:3001` frontend is cross-origin and sends no cookie → 401 → broken avatar. A Next rewrite maps same-origin `/api/files/:id` → `${NEXT_PUBLIC_API_URL}/files/:id`; Next proxies server-side carrying the cookie, backend authorises, image loads. No new env (reuses `NEXT_PUBLIC_API_URL`), no second download route, no public-file hole. Avatars are low-sensitivity anyway — a file with no `project_documents` row keeps add-file-storage's "any authenticated user may download" behaviour, which is correct for an avatar.

### Avatar persistence timing
Upload-on-pick: choosing a file immediately `PATCH /users/me/avatar`s and refreshes the store, so the nav avatar updates without a modal "Save". Name is a separate `PATCH /users/me` behind "Save". This keeps each write atomic and independently verifiable, and means a half-filled password section never blocks an avatar change.

## Architecture

```
Avatar display:
  nav-user <AvatarImage src="/api/files/{avatarFileId}">
     → Next rewrite /api/files/:id → NEXT_PUBLIC_API_URL/files/:id  (cookie forwarded)
     → FilesController.download → JwtAuthGuard → stream bytes

Writes (all JwtAuthGuard, req.user = current user):
  Profile modal
   ├─ name     → PATCH /users/me          → ProfileController → UsersService.rename → UserDto
   ├─ avatar   → PATCH /users/me/avatar    → ProfileController(FileInterceptor 5MB/img)
   │              → FilesService.store(file, userId) → UsersService.setAvatarFile(userId, fileId) → UserDto
   └─ password → POST  /users/me/password  → ProfileController → ProfileService.changePassword
                  → verifyPassword(current) | ProfileErrors.INVALID_CURRENT_PASSWORD
                  → hashPassword(new) → UsersService.setPasswordHash → {success:true}

Module graph:
  ProfileModule → UsersModule, FilesModule   (leaf; no cycle)
```

Components named here are the same ones the `tasks.md` subtasks create.

## Impact Area

### Blast radius (resolved against the code)
- `backend/src/users/user.entity.ts` — add `avatarFileId` column. Read by every `users` query; additive nullable, transparent (see db.md).
- `backend/src/users/dto/user.dto.ts` — add `@Expose() avatarFileId`. **Shared response shape**: flows through `GET /auth/me`, `POST /auth/login` (`toUserDto` in `auth.controller.ts:16`) and the new endpoints. Frontend `UserDto` type is regenerated.
- `backend/src/users/users.service.ts` — add `rename`, `setAvatarFile`, `setPasswordHash`. Existing methods untouched.
- `backend/src/app.module.ts` — one import line for `ProfileModule` (same shape as every prior module registration).
- `backend/src/auth/**` — **not touched.** `validate` and its spec stay as-is.
- `frontend/components/sidebar/nav-user.tsx` — the one high-touch frontend edit: disabled item → live item + controlled modal, and the avatar gains `<AvatarImage>`. `initialsOf` export reused.
- `frontend/next.config.ts` — add `rewrites()`. Currently empty; the `/api/files/:id` rule is the only entry.
- `frontend/types/api/**` — regenerated by `pnpm api:types`, never hand-edited (rules.md).

### Decision Defaults (worker resolves gray areas with these, no stall)
1. **New-password minimum = 8 chars.** `add-login`'s `LoginDto.password` enforces only `@IsNotEmpty()` (no min). Login must not reject legacy passwords, but a *new* password may demand more. `newPassword: @IsString() @MinLength(8)`; `currentPassword: @IsString() @IsNotEmpty()`.
2. **Wrong current password → 401, `PROFILE_INVALID_CURRENT_PASSWORD`.** A dedicated `ProfileErrors` (via `defineErrors('PROFILE', …)`), not `AuthErrors.INVALID_CREDENTIALS` — different domain, and the message may be specific here ("Current password is incorrect") since the user is already authenticated, so there is no account-existence oracle to protect.
3. **Password change response = `{ success: true }`**, HTTP 200 (mirrors `logout`). It does not return a new token — the session stays valid (no invalidation, see below).
4. **Avatar MIME set = png/jpeg/webp/gif** — the raster subset of `files.constants.ts` `MIME_EXTENSIONS`. SVG stays excluded (executable XML). The `fileFilter` reuses `FileErrors.UNSUPPORTED_TYPE` on rejection, handed to multer's callback (not thrown) exactly as `FilesModule` does.
5. **Avatar oversize/invalid → multer rejects → `UploadErrorInterceptor` maps it.** Reuse the existing `UploadErrorInterceptor` (`files/`) on the avatar route so a 5 MB breach surfaces as the same clean `AppException`, not a raw multer error.
6. **Avatar size limit = 5 MB**, as a constant in `profile.constants.ts` (`AVATAR_MAX_SIZE_BYTES`). Not an env var — nothing varies it per environment (same reasoning as `MAX_FILE_SIZE_BYTES`).
7. **Name constraint** = `@IsString() @IsNotEmpty() @MaxLength(255)` (column is varchar(255)). Trim before save.
8. **`avatarFileId` serialises as the bare file id**, not a URL. The backend stays ignorant of the frontend's `/api` proxy path; the frontend builds `/api/files/${avatarFileId}`.
9. **Replaced avatar orphans the old file row** — accepted, no delete (files has no delete path, RESTRICT). Matches repo precedent; do not build cleanup.
10. **Avatar upload timing = on pick**; name = on "Save"; password = on "Update password". Three independent submits.
11. **Password mutation defines its own `onError`** so the 401 renders as an inline banner in the password section and the global MutationCache toast stands down (same mechanism as `useLogin` in `hooks/use-auth.ts`). Avatar + name use the default global toast on error.
12. **Rewrite scope = `/api/files/:path*` only.** The frontend's axios client talks to `NEXT_PUBLIC_API_URL` directly (cross-origin, `withCredentials`), so `/api` is otherwise unused — scope the rewrite narrowly, don't blanket-proxy.

### Risk / reversibility
- **DB**: additive, nullable, reverts clean (db.md). Low risk.
- **Security-sensitive**: the password path. Mitigated by tests-first (verify current → 401; success rotates hash) and by leaving `AuthService.validate` untouched. The hash helper uses `argon2id` (same as seed + validate).
- **Highest-touch edit**: `nav-user.tsx` (shared surface) and `UserDto` (shared response). Both additive; the API-type regen makes the DTO change visible to the frontend compiler.
- **Reversible**: yes end-to-end — drop the migration, delete `profile/`, revert the two shared-file edits.

## Rejected approaches
- **`UsersController` inside `UsersModule`** — closes the `Users→Files→Projects→Users` cycle, needs `forwardRef`. Rejected for the leaf `ProfileModule`.
- **Public unguarded avatar endpoint** (`GET /users/:id/avatar`) — a second bytes-serving route is a second place to get authorisation wrong; `files.controller.ts` explicitly warns against a duplicate download path. Rejected for the Next proxy.
- **Base64 avatar in `UserDto`** — bloats every `/auth/me`, no caching. Rejected.
- **Routing `AuthService.validate` through the new helper** — edits the auth oracle + spec for no functional gain this change needs. Deferred as optional.

## Open questions
None blocking. The two accepted costs (avatar orphans, no session invalidation on password change) are recorded in `proposal.md` scope-out; neither needs a human decision to proceed.
