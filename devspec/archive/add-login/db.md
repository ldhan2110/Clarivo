# DB: add-login

**Source**: **live** — read read-only via `docker exec clarivo-postgres-1 psql -U postgres -d clarivo` (no Postgres MCP is connected; this is the live container, not migration files).
**Dialect**: postgresql 17.11 · schema `public` · container `clarivo-postgres-1`, host port **5437**
**Conventions**: `devspec/context/schema.md` + `conventions.md` backend block.

## Current state

```
public.migrations   ← TypeORM bookkeeping only, 0 rows
```

**No migration has ever run.** The `migrations` table exists but is empty, so `users` is both the first domain table and the first migration this repo executes. Extensions installed: `plpgsql` only (`citext`, `pgcrypto`, `uuid-ossp` are *available* but not created).

## Tables touched

### users  (new)

| col | type | null | default | mark | note |
|-----|------|------|---------|------|------|
| `id` | `uuid` | no | — | add | PK. **Generated in the app** (uuid v7, `@BeforeInsert`) — no DB default, per `BaseEntity` (`backend/src/database/base.entity.ts:9`) |
| `email` | `varchar(255)` | no | — | add | Unique. Stored **lowercased by the application** — see open question 1 |
| `password_hash` | `varchar(255)` | no | — | add | argon2id encoded string (`$argon2id$v=19$...`, ~97 chars). Never `@Expose()`d |
| `name` | `varchar(255)` | no | — | add | Display name for the dashboard greeting / avatar label |
| `created_at` | `timestamptz` | no | `now()` | add | From `BaseEntity` `@CreateDateColumn` |
| `updated_at` | `timestamptz` | no | `now()` | add | From `BaseEntity` `@UpdateDateColumn` |

**Indexes**
| name | cols | kind | why |
|------|------|------|-----|
| `PK_users` | `id` | primary | TypeORM default name |
| `UQ_users_email` | `email` | unique | Login looks up by email; the unique constraint provides the index — no separate one needed |

No FKs — `users` is the root table and nothing references it yet.

## Conventions this establishes

`schema.md` lists these as "not yet established". This change decides them, and everything after copies it:

| Decision | Value | Rationale |
|----------|-------|-----------|
| Table naming | **snake_case, plural** — `users` | Matches the column convention already in `BaseEntity`; plural is the TypeORM/Postgres norm |
| Column naming | **snake_case**, set explicitly via `name:` on the decorator | Continues `base.entity.ts:12`; there is no global naming strategy configured, so every multi-word column must name itself |
| String columns | `varchar(255)` unless a real length is known | Avoids unbounded `text` for identity fields |
| FK naming | *deferred* — no FK in this change | First table with an FK decides it |

## Impact

Blast radius is **empty**. Verified against the code graph and the file tree:
- Zero entities exist (`backend/src/database/migrations/` holds only `.gitkeep`; no `*.entity.ts` anywhere).
- Zero repositories, services, or controllers read or write any table.
- Nothing else in the repo touches `users`, so there is no shared-table seam and no query to regress.

**Migration verdict: purely additive.** One new table on an empty database. No backfill, no data reshape, no existing row to migrate, no destructive operation. Trivially revertible.

**Real risk is the pipeline, not the schema.** This is the first generate → run cycle in the repo. `pnpm migration:generate` compiles to `dist/` first (`backend/package.json`), so a TS error surfaces as a confusing migration failure, and the glob `src/**/*.entity{.ts,.js}` means a file not named `*.entity.ts` is silently invisible to TypeORM (`backend/src/config/database.config.ts:21`).

## Seed

One admin row, inserted by an idempotent **application script** (`pnpm seed`), not by a migration:
- Reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` from env (added to `env.validation.ts` + `.env.example`).
- Upserts by email, so rerunning is safe and it never duplicates.
- Hashing happens in the script, so **no credential is ever committed** — which a seed migration with a hardcoded hash could not avoid.

## Open questions

1. **Email case-insensitivity — `citext` or application lowercasing?**
   `citext` is available in this image but not installed; using it means an `CREATE EXTENSION` step in the migration and a non-standard column type. Recommended default: **plain `varchar` + lowercase the email in the service before both insert and lookup**, so the unique index does the work with no extension. Flagged because it's a one-way-ish decision — switching to `citext` later is an `ALTER TYPE` plus a dedupe.
2. **Length of `password_hash`** — `varchar(255)` fits argon2id comfortably. Only revisit if the hasher changes.

## Suggested verify hooks

For capture's `tasks.md` section `Verify:` lines:
- **Schema assertion** — after `migration:run`, `\d users` shows all six columns with the types/nullability above, plus a unique index on `email`.
- **Migration round-trip** — `pnpm migration:run` then `pnpm migration:revert` applies and rolls back cleanly against the local DB.
- **Seed idempotency** — `pnpm seed` twice leaves exactly one row (`select count(*) from users where email = $SEED_ADMIN_EMAIL` → 1).
- **Uniqueness** — inserting a second row with the same email raises a unique violation, surfaced as a domain error rather than a 500.
