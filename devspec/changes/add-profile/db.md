# DB: add-profile

**Source**: postgres (live) — `psql -h 10.0.68.250 -p 5437 -U postgres -d clarivo`, read 2026-10-02
**Dialect**: postgresql 17 (per `conventions.md` backend block) · **Schema**: `public`
**Migration tool**: TypeORM CLI, `pnpm migration:generate` → dir `backend/src/database/migrations/`. This is the **5th** migration.

## Tables touched

### `users` (exists, 2 rows)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | uuid | no | — | PK `PK_a3ffb1c0c8416b9fc6f907b7433` |
| created_at / updated_at | timestamptz | no | now() | from BaseEntity |
| email | varchar(255) | no | — | unique `UQ_97672ac88f789774dd47f7c8be3`, stored lowercased |
| password_hash | varchar(255) | no | — | argon2id, never `@Expose()`d |
| name | varchar(255) | no | — | |
| **avatar_file_id** | **uuid** | **yes (add)** | — | **new.** FK → `files(id)` **ON DELETE RESTRICT**. Nullable — the 2 existing users get NULL, **no backfill**. Column on the entity: `avatarFileId`. No index (no per-file reverse lookup needed). |

### `files` (exists, **0 rows**)
| col | type | null | note |
|-----|------|------|------|
| id | uuid | no | PK — the FK target. Type matches (`uuid`→`uuid`). |
| uploaded_by | uuid | no | FK → `users(id)` ON DELETE RESTRICT (pre-existing) |

No change to `files`. Listed only because it is the FK target.

## Impact
- **New FK edge `users.avatar_file_id → files.id`** closes a cycle: `files.uploaded_by → users.id` already exists in the other direction. **Safe only because `avatar_file_id` is nullable** — a user row is created with a NULL avatar, the avatar file is uploaded afterward (`uploaded_by` = that user), then `avatar_file_id` is set. No insert chicken-and-egg, no deadlock. A NOT NULL avatar column would be unsatisfiable; keep it nullable.
- **ON DELETE RESTRICT, matching the repo default** (`schema.md`: RESTRICT is the rule, CASCADE the documented exception). Deleting a `files` row that is some user's avatar is blocked — correct: the bytes on disk outlive no FK, and there is no user-delete path anyway. No new CASCADE.
- **Readers/writers of `users`** — `UsersService.findById` / `findByEmail` / `upsertByEmail` (`backend/src/users/users.service.ts`), `AuthService.validate` (`backend/src/auth/auth.service.ts:24`), `toUserDto` in `backend/src/auth/auth.controller.ts:16`. All `SELECT *` / entity-mapped, so an added nullable column is **transparent** to every existing read — it simply appears as `null`. `UserDto` only serialises `@Expose()`d fields, so the new column does **not** leak until a DTO opts it in (this change adds `avatarFileId` to `UserDto`).
- `files` has **0 rows**, so there are no orphan/avatar rows to reconcile and the FK is trivially valid at migration time.

## Migration verdict
**Purely additive.** One nullable column + one FK constraint on `users`. No column altered/dropped, no data reshape, no backfill. Reverts clean by dropping the column (then the FK drops with it). `pnpm migration:*` builds first and runs against `dist/` — compile clean before generating, or a TS error surfaces as a confusing migration failure (`rules.md`).

**No destructive operation** anywhere in this change (no DROP/DELETE/TRUNCATE).

## Verify hooks (for tasks.md)
- schema assertion: after `migration:run`, `\d users` shows `avatar_file_id uuid` NULL with FK → files(id) ON DELETE RESTRICT.
- migration round-trips: `pnpm migration:run` then `pnpm migration:revert` on a scratch DB leaves `users` back at 5 columns.
- no-regression: `pnpm test` (users + auth specs) still green — the added nullable column is transparent to existing reads.

## Open questions
None. Nullability, FK target, and ON DELETE are all settled by the repo's existing RESTRICT default and the insert-ordering constraint above. (Avatar-replacement orphaning old `files` rows is an application concern, not a schema one — handled in `design.md`, not here.)
