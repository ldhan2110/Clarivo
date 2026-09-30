# DB: backend-foundation

**Source**: live — `psql` inside the running `clarivo-postgres-1` container. No Postgres MCP is connected this session, so the read went through the container CLI rather than an MCP; it is still the live server, not migration files.
**Dialect**: postgresql **17.11** (`postgres:17-alpine`)
**Database / role**: `clarivo` / `clarivo` · encoding UTF8 · server `TimeZone` UTC
**Host port**: 5433 → container 5432 (5432 is held by a native Postgres install per `context/conventions.md`)

`context/` has no `schema.md` — init recorded "no database" because the repo carries no DDL, compose file, or ORM models. That was true of the repo and wrong about the environment: a live server was already running. Correcting `context/schema.md` is a follow-up to this change, not part of it.

## Server capability scan

The decisive fact for this change. Checked against `pg_proc`, then confirmed by calling it:

| function | status |
|---|---|
| `uuidv7()` | **absent** — `ERROR: function uuidv7() does not exist` |
| `uuidv4()` | absent |
| `gen_random_uuid()` | present (v4, built in since PG13) |
| `uuid_generate_v4()` | absent (`uuid-ossp` is available but not installed — and offers no v7 either) |

Installed extensions: `plpgsql v1.0` only.

**`uuidv7()` is a PostgreSQL 18 function.** On 17 there is no native v7 generator, and no extension supplies one. This invalidates the originally captured PK strategy (`@PrimaryColumn('uuid', { default: () => 'uuidv7()' })`) — see Amendments in `proposal.md`.

## Current state of `public`

**0 tables.** The schema was emptied immediately before this scan: it previously held 13 tables plus a `drizzle` schema left behind by an earlier backend scaffold whose code no longer exists in the repo (`org`, `user`, `membership`, `project`, `session`, `utterance`, `question`, `session_question_state`, `suggestion`, `requirement`, `requirement_version`, `evidence`, `refresh_token`, `drizzle.__drizzle_migrations`), carrying test rows from a prior session's end-to-end run.

Dropped on explicit instruction, after a verified `pg_dump` to `/Users/admin/clarivo-db-backup-20260930-150237.sql` (14 `CREATE TABLE`, 14 `COPY` blocks, 3 `user` rows, 7 `refresh_token` rows). Restore with `psql -U clarivo -d clarivo < <that file>`.

So this change migrates into a genuinely empty schema, and the spec's "applies to a database with no tables" scenario holds.

## Tables touched

### `migrations` (new — created by TypeORM, not by a migration)
TypeORM's own bookkeeping table, created on first `migration:run`. Not hand-specced; listed so a reviewer isn't surprised by it.

| col | type | null | default | note |
|---|---|---|---|---|
| id | serial | no | sequence | PK, TypeORM-managed |
| timestamp | bigint | no | — | migration version |
| name | varchar | no | — | migration class name |

### `_probe` (new — temporary)
The throwaway table the initial migration is generated from, because `AbstractEntity` is abstract and has no table of its own. Exercises every base-class column so §4's behaviour is testable. Removed, with its own forward migration, by the change that adds the first real entity.

| col | type | null | default | note |
|---|---|---|---|---|
| id | uuid | no | **none — assigned by the application** | PK. `@BeforeInsert()` calls `v7()` from the `uuid` package. **Not** a DB default: `uuidv7()` does not exist on 17, and `gen_random_uuid()` would silently produce v4 |
| created_at | timestamptz | no | `now()` | `@CreateDateColumn` |
| created_by | uuid | yes | — | **no FK** — no `users` table exists, and adding one later would make `users` circular against its own base class |
| updated_at | timestamptz | no | `now()` | `@UpdateDateColumn` |
| updated_by | uuid | yes | — | no FK, same reason |
| deleted_at | timestamptz | yes | — | `@DeleteDateColumn`, soft delete |

Column names are `snake_case` via the hand-written `SnakeNamingStrategy`; entity properties stay camelCase. Server `TimeZone` is UTC, so `timestamptz` round-trips without a local-offset surprise.

## Impact

- **No existing readers or writers.** `public` is empty and the repo has no ORM, no repository, and no query code — `context/patterns.md` records data access as "not yet established". Blast radius inside the database is therefore nil.
- **No shared tables.** `backend-foundation` is the only change on the board, so no second feature writes anything here.
- **Migration verdict: additive, forward-only.** Two new tables, no `ALTER` against populated data, no backfill, no destructive step. The one destructive act in this session — dropping the 13 orphaned tables — was done by explicit human instruction *outside* the migration, is backed up, and is deliberately **not** encoded as a migration.
- **The `id` default moves from the database to the application.** Consequence worth stating plainly: an `INSERT` issued as raw SQL, from a seed script, or inside a future migration will **fail** on `id` being null unless it supplies one. Under the original PG18 plan the database covered that case. It no longer does.

## Open questions

- **Correct `context/schema.md`.** Init declared no database. There is one. Worth a `/devspec-init` refresh once this change lands, so later changes ground on the real server version and the `uuidv7()` gap instead of rediscovering it.
- **Upgrade path to 18.** If the deploy target ever runs 18, the `@BeforeInsert()` hook becomes redundant and a DB-side `uuidv7()` default would be preferable. A 17→18 jump has no in-place upgrade for the existing volume, so that is a deliberate future change, not a config flip.
- **`_probe` removal is a promise, not a guarantee.** It relies on the next entity-adding change actually dropping it. If that change never comes, a stray table lingers. Its removal migration is destructive by nature (drop table) and will need a human decision at that point.

## Suggested verify hooks

For capture to turn into section `Verify:` lines — not run here:

- **Schema assertion** — query `information_schema.columns` for `_probe` and assert all six columns exist with the right type and nullability, and that `created_by` / `updated_by` carry no FK constraint.
- **Migration runs clean** — `migration:run` on the empty schema, a second `migration:run` is a no-op, `migration:revert` executes `down`, re-apply leaves the same shape.
- **uuid v7 is real v7** — insert without an id and assert the returned uuid's version nibble is `7`, plus two sequential inserts sort in insertion order. This is the check that catches a silent regression to `gen_random_uuid()`.
- **No-regression** — not applicable: no pre-existing queries survive.
