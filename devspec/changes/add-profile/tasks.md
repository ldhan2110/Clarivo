# Tasks: add-profile

> Backend gate: `cd backend && pnpm lint && pnpm test && pnpm build`. Frontend gate: `cd frontend && pnpm lint && pnpm build`.
> Do NOT run `pnpm test:e2e` or touch `backend/test/app.e2e-spec.ts` (pre-existing failure, out of scope — see devspec/report/blockers.md).
> `pnpm migration:*` build first and run against `dist/` — compile clean before generating.

## 1. Avatar column + migration [req-1]
- [x] 1.1 [backend] Add column to `backend/src/users/user.entity.ts`: `avatarFileId` uuid nullable. Paired with a deferred `@ManyToOne(() => FileEntity) @JoinColumn({name:'avatar_file_id'})` relation — the repo drives FK generation through a relation (FileEntity.uploader does the same); lazy arrow keeps the users↔files import cycle safe.
- [x] 1.2 [db] Generated `src/database/migrations/1790907595008-AddUserAvatar.ts` — ADD COLUMN avatar_file_id uuid + ADD CONSTRAINT FK → files(id) ON DELETE RESTRICT, nullable, no backfill. Applied. autoLoadEntities handles registration.
- [x] 1.3 [test] Confirmed live via `\d users`: `avatar_file_id uuid` nullable with `FK_65eb1fa7df7811daaec973798ce` → files(id) ON DELETE RESTRICT. Migration round-trips clean (run/revert/run). (No DB-connecting vitest test — the repo's unit tests don't hit the DB; the round-trip + schema assert is the proof.)
Verify: `cd backend && pnpm migration:run && pnpm migration:revert && pnpm migration:run` round-trips clean; `pnpm build` green.

## 2. Expose avatarFileId on the user response [req-2]
- [x] 2.1 [backend] Added `@Expose() avatarFileId: string | null;` to `user.dto.ts`. `passwordHash` stays unexposed.
- [x] 2.2 [test] `backend/src/users/user.dto.spec.ts` — avatarFileId exposed (value + null), passwordHash never serialised. 3 pass.
Verify: `cd backend && pnpm test` (DTO spec green).

## 3. Password helper [req-4]
- [x] 3.1 [backend] New `backend/src/users/password.ts`: `hashPassword` (argon2id, same options as seed) + `verifyPassword`. `auth.service.ts` untouched.
- [x] 3.2 [test] `backend/src/users/password.spec.ts` — hash verifies against original, rejects wrong. 2 pass.
Verify: `cd backend && pnpm test`.

## 4. UsersService write methods [req-3][req-4][req-5]
- [x] 4.1 [service] Added `rename`, `setAvatarFile`, `setPasswordHash` to `users.service.ts` (update + reload via findOneOrFail). Existing methods untouched.
- [x] 4.2 [test] Extended `users.service.spec.ts` — rename/setPasswordHash/setAvatarFile write the right columns. 6 pass.
Verify: `cd backend && pnpm test`.

## 5. Profile module: name + password endpoints [req-3][req-4]
- [x] 5.1 [backend] `profile.errors.ts` — `ProfileErrors = defineErrors('PROFILE', { INVALID_CURRENT_PASSWORD: 401 })`.
- [x] 5.2 [backend] `dto/update-profile.dto.ts` (name: string, non-empty, ≤255) + `dto/change-password.dto.ts` (currentPassword non-empty, newPassword ≥8).
- [x] 5.3 [service] `profile.service.ts` — `updateName` (trims) + `changePassword` (verify current via helper → 401, else hash+setPasswordHash).
- [x] 5.4 [backend] `profile.controller.ts` `@Controller('users/me')` guarded: `PATCH ''` name → UserDto; `POST 'password'` @HttpCode(200) → `{success:true}`. Local `toUserDto` mirrors auth.controller.
- [x] 5.5 [backend] `profile.module.ts` imports [UsersModule, FilesModule]; registered in `app.module.ts`.
- [x] 5.6 [test] `profile.service.spec.ts` — correct current rotates hash (new verifies, old doesn't); wrong current → PROFILE_INVALID_CURRENT_PASSWORD, no write; name trimmed. 3 pass.
Verify: `cd backend && pnpm test` (profile service spec: right/wrong current password, name trim).

## 6. Profile module: avatar endpoint [req-5]
- [x] 6.1 [backend] `profile.constants.ts` — `AVATAR_MAX_SIZE_BYTES = 5MB`, `AVATAR_MIME_TYPES` (png/jpeg/webp/gif).
- [x] 6.2 [backend] `PATCH 'avatar'` on ProfileController — `UploadErrorInterceptor` + `FileInterceptor('file', { limits 5MB, fileFilter images-only → FileErrors.UNSUPPORTED_TYPE })`, empty `UploadAvatarDto`. Handler: no-file guard → `files.store` → `users.setAvatarFile` → `toUserDto`. FilesService + UsersService injected.
- [x] 6.3 [test] `avatar.spec.ts` — valid image routes store→setAvatarFile→dto; no-file → FILE_UNSUPPORTED_TYPE; AVATAR_MIME_TYPES includes raster, excludes svg+pdf. 4 pass. (Multer size enforcement is multer's own concern; the predicate + orchestration are asserted.)
Verify: `cd backend && pnpm test` && `pnpm build`.

## 7. Regenerate API types [req-2][req-3][req-4][req-5]
- [ ] 7.1 [frontend] With the backend running, `cd frontend && pnpm api:types`. Confirms `UserDto.avatarFileId` and the three `/users/me*` operations land in `frontend/types/api/types.gen.ts`. NEVER hand-edit that file.
Verify: `cd frontend && pnpm build` (types compile).

## 8. Next rewrite proxy for avatar images [req-6]
- [ ] 8.1 [frontend] In `frontend/next.config.ts` add `async rewrites()` returning `[{ source: '/api/files/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/files/:path*` }]`. Scope to `/api/files` only — the axios client already talks to the API cross-origin, so `/api` is otherwise free.
Verify: `cd frontend && pnpm build`; manual: `curl -I http://localhost:3001/api/files/<id>` with a session cookie proxies to the backend (returns 200/401 from backend, not a Next 404).

## 9. Profile data layer (services + hooks) [req-3][req-4][req-5]
- [ ] 9.1 [frontend] New `frontend/services/users.ts`: `patchProfile(body: {name}) → api.patch<UserDto>('/users/me')`; `changePassword(body: {currentPassword,newPassword}) → api.post('/users/me/password')`; `uploadAvatar(file: File) → FormData('file') → api.patch<UserDto>('/users/me/avatar', fd)`. Follows `services/auth.ts` shape.
- [ ] 9.2 [frontend] New `frontend/hooks/use-profile.ts`: `useUpdateProfile()` and `useUploadAvatar()` — `onSuccess: (u) => useAuthStore.getState().setUser(u)` so nav refreshes; `useChangePassword()` — define `onError: () => {}` to stand down the global toast (surface 401 inline), `onSuccess` fires the "Password updated" success toast. Mirror `hooks/use-auth.ts`.
Verify: `cd frontend && pnpm build` && `pnpm lint`.

## 10. Profile modal + nav-user wiring [req-7]
- [ ] 10.1 [frontend] New `frontend/components/profile/profile-dialog.tsx`: controlled `<Dialog open onOpenChange>`. Reuse `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription` (`components/ui/dialog.tsx`), `Input` (`components/ui/input.tsx`), `Label` (`components/ui/label.tsx`), `Button` (`components/ui/button.tsx`), `Avatar/AvatarImage/AvatarFallback` (`components/ui/avatar.tsx`). Two sections per `ui.md`, each its own submit.
- [ ] 10.2 [frontend] Section 1 — avatar: hidden `<input type=file accept="image/png,image/jpeg,image/webp,image/gif">`; on pick validate ≤5 MB + type client-side (else inline error), show `URL.createObjectURL` preview, call `useUploadAvatar`. Name: react-hook-form + zod (`name` nonempty, ≤255), "Save" → `useUpdateProfile`. Never use `watch()` (frontend rule); use rhf state. Avatar `<AvatarImage src={`/api/files/${user.avatarFileId}`}>` when set, `initialsOf(user.name)` fallback.
- [ ] 10.3 [frontend] Section 2 — password: rhf + zod `{ currentPassword: nonempty, newPassword: min(8), confirm }` with `.refine(d => d.newPassword === d.confirm)`; "Update password" → `useChangePassword`; render inline banner on 401, clear fields on success.
- [ ] 10.4 [frontend] Edit `frontend/components/sidebar/nav-user.tsx`: replace the disabled "Profile / Soon" `DropdownMenuItem` with a live one that opens `ProfileDialog` (local `useState` open). Add `<AvatarImage>` to the trigger `<Avatar>` using `user.avatarFileId`. Keep `initialsOf` fallback and the sign-out item unchanged.
Verify: `/devspec-verify add-profile` — agent-browser (login as admin@clarivo.local / Clarivo!2026): open Profile from nav-user; both sections render with non-plain styling; name save updates the nav label; picking an image shows a preview; password mismatch disables submit; wrong current password shows the inline banner.
