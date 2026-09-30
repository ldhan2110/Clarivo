# Schema conventions

**Source**: live Postgres (`docker exec … psql`) + repo code. No DB MCP is connected.
**Dialect**: postgresql 17 · **Schema**: `public` · **Domain tables**: **0**

> The database contains only TypeORM's own `migrations` bookkeeping table. Every convention below comes from `backend/src/database/base.entity.ts` and `backend/src/config/database.config.ts`, which bind any future table — **not** from observed tables. The first domain entity establishes the rest (table-name case, FK naming, index naming); it should follow TypeORM's `snake_case` column mapping already used by `BaseEntity`.

| Area | Convention | Evidence |
|------|-----------|----------|
| **PK** | `id uuid`, **uuid v7 generated in the app** via `@BeforeInsert`, not by the DB. Postgres 17 has no `uuidv7()`. Time-sortable, so no separate sequence needed | `base.entity.ts:9` |
| **Timestamps** | `created_at` / `updated_at`, both `timestamptz`, via `@CreateDateColumn` / `@UpdateDateColumn` on every table | `base.entity.ts:12` |
| **Column naming** | snake_case, set explicitly with `name:` on the decorator — there is no global naming strategy configured | `base.entity.ts:12` |
| **Soft delete** | None. No `deleted_at` anywhere | — |
| **Schema changes** | Migrations only. `synchronize: false` in **every** environment | `database.config.ts:25` |
| **Entity discovery** | Glob `src/**/*.entity{.ts,.js}` — an entity file must end in `.entity.ts` or TypeORM will not see it | `database.config.ts:21` |
| **Migration discovery** | `src/database/migrations/*{.ts,.js}`, tracked in table `migrations` | `database.config.ts:22` |
| **Logging** | dev logs `error`, `warn`, `migration`; prod logs `error` only | `database.config.ts:26` |

## Not yet established
Table-name case and plurality, FK column naming and on-delete behaviour, index naming, enum-vs-lookup-table, money and JSON column types. **Decide these on the first entity and refresh this file** — everything after will copy it.
