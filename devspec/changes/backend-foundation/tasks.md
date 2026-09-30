# Tasks: backend-foundation

All paths are relative to `backend/` unless stated otherwise. Sections run top-to-bottom; each depends only on the ones above it.

Layer tags: `[backend]` `[db]` `[test]` `[infra]`. `[infra]` covers Docker/Compose work — see the note in `design.md`, it is a deliberate addition to the documented tag set so the reviewer's per-layer scan stays meaningful.

## 1. Local PostgreSQL 18 service [req-8]
Everything below needs a reachable database to verify against, so this comes first.
- [ ] 1.1 [infra] New `docker-compose.yml` at the **repo root** — one `db` service, image `postgres:18-alpine`, ports `5433:5432` (5432 is taken by a native install per `context/rules.md`)
- [ ] 1.2 [infra] Environment `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` sourced from `backend/.env`; named volume `clarivo_pgdata` mounted at `/var/lib/postgresql/data`
- [ ] 1.3 [infra] Healthcheck `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`, interval 5s, 10 retries — so dependents wait on readiness, not on the port opening
- [ ] 1.4 [infra] Confirm the server reports major version 18 and that `SELECT uuidv7()` resolves — this is the hard floor the PK strategy depends on

Verify: `docker compose up -d db && docker compose exec -T db psql -U clarivo -d clarivo -c "SHOW server_version; SELECT uuidv7();"`

## 2. Validated environment configuration [req-1]
- [ ] 2.1 [backend] Add dependencies: `@nestjs/config`, `class-validator`, `class-transformer`
- [ ] 2.2 [backend] New `src/config/env.validation.ts` — class `EnvironmentVariables` with `class-validator` decorators: `NODE_ENV` (`@IsIn(['development','test','production'])`, default `development`), `PORT` (`@IsInt` `@Min(1)` `@Max(65535)`, default 3000), `DATABASE_HOST`, `DATABASE_PORT` (`@IsInt`), `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (all `@IsNotEmpty` strings, no defaults — absence must fail)
- [ ] 2.3 [backend] Export `validate(config: Record<string, unknown>)` — `plainToInstance` with `enableImplicitConversion: true` (env values arrive as strings; this is the one place coercion is correct), then `validateSync` with `skipMissingProperties: false`. On any error, log **every** offender with its failed constraint and `process.exit(1)`. Returns the validated instance so `ConfigService` is typed
- [ ] 2.4 [backend] Register in `src/app.module.ts`: `ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: '.env' })`
- [ ] 2.5 [backend] New `.env.example` — every variable above with placeholder values and **no real secrets**. `.env` is already gitignored (`.gitignore`); confirm `.env.example` is not
- [ ] 2.6 [test] New `src/config/env.validation.spec.ts` — missing `DATABASE_PASSWORD` throws/exits naming it; `PORT=not-a-number` fails naming `PORT`; two missing vars report both; a complete env passes and returns coerced numbers; omitted `PORT`/`NODE_ENV` yield 3000 / `development`

Verify: `pnpm test src/config/env.validation.spec.ts`

## 3. TypeORM connection from validated config [req-2]
- [ ] 3.1 [backend] Add dependencies: `@nestjs/typeorm`, `typeorm`, `pg`
- [ ] 3.2 [db] New `src/common/database/naming.strategy.ts` — `SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface`, snake-casing table names, column names, and join-column names. No new dependency (see `design.md`)
- [ ] 3.3 [db] New `src/database/entities.ts` — explicit barrel exporting the entity array. **No globs**: `context/rules.md` records that `__dirname` does not exist in this ESM package and a stale glob fails at query time, not at boot
- [ ] 3.4 [backend] New `src/config/database.config.ts` — factory returning `TypeOrmModuleOptions` from `ConfigService` only, never `process.env`. `type: 'postgres'`, entities from the barrel, `namingStrategy: new SnakeNamingStrategy()`, `synchronize: false`, `migrationsRun: false`, `logging` on only when `NODE_ENV === 'development'`
- [ ] 3.5 [backend] Register `TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory })` in `src/app.module.ts`
- [ ] 3.6 [test] New `src/database/data-source.spec.ts` — resolved options have `synchronize === false`; the factory reads from a stubbed `ConfigService` rather than `process.env`
- [ ] 3.7 [test] Extend `test/app.e2e-spec.ts` — the app boots with the DB up, `DataSource.isInitialized` is true, `SELECT 1` succeeds; with `DATABASE_HOST` pointed at a dead port, boot rejects

Verify: `pnpm test src/database/data-source.spec.ts && pnpm test:e2e`

## 4. Shared abstract entity [req-4]
- [ ] 4.1 [db] New `src/common/entities/abstract.entity.ts` — `AbstractEntity`, named to avoid colliding with TypeORM's exported `BaseEntity` (its ActiveRecord class)
- [ ] 4.2 [db] Primary key: `@PrimaryColumn('uuid', { default: () => 'uuidv7()' })`. **Not** `@PrimaryGeneratedColumn('uuid')` — that emits `gen_random_uuid()`, which is v4
- [ ] 4.3 [db] `@CreateDateColumn` / `@UpdateDateColumn` as `timestamptz`; `@DeleteDateColumn` as nullable `timestamptz` for soft delete
- [ ] 4.4 [db] `createdBy` / `updatedBy` — nullable `uuid`, **no** `@ManyToOne`, **no** foreign key. Nothing writes them in this change; the deferred `auth` change fills them (rationale in `design.md`)
- [ ] 4.5 [db] Add a throwaway `__ProbeEntity` (table `_probe`) to the barrel so section 5 has something to generate a migration from and section 4's behaviour is testable. Remove it — and its migration — in the change that adds the first real entity; leave a comment saying so
- [ ] 4.6 [test] New `test/abstract-entity.e2e-spec.ts` against `_probe` — insert without id yields a uuid with version nibble 7; two sequential inserts sort in insertion order; update leaves `created_at` and advances `updated_at`; soft-remove sets `deleted_at`, is hidden from a default `find`, and returned with `withDeleted: true`; insert succeeds with both audit-user columns null; the created table's columns are snake_case

Verify: `pnpm test:e2e test/abstract-entity.e2e-spec.ts`

## 5. Migration workflow and initial migration [req-3]
- [ ] 5.1 [db] New `src/database/data-source.ts` — standalone `DataSource` for the CLI, built from the **same** options object as `src/config/database.config.ts` so the two cannot drift. Adds `migrations: ['dist/database/migrations/*.js']` and `migrationsTableName: 'migrations'`. Loads `.env` itself (no Nest container here)
- [ ] 5.2 [backend] Add `package.json` scripts, each building first then invoking the CLI on the **compiled** DataSource — no `ts-node`, no `tsx`, no `--loader`: `migration:generate`, `migration:run`, `migration:revert`, all as `nest build && node node_modules/typeorm/cli.js -d dist/database/data-source.js <cmd>`
- [ ] 5.3 [backend] Confirm the CLI entry path resolves (`node_modules/typeorm/cli.js`) under this package's ESM resolution before wiring the scripts
- [ ] 5.4 [db] Generate the initial migration into `src/database/migrations/` and confirm it is **`.ts`** — TypeScript is the CLI default, `-o/--outputJs` is the opt-in. No hand-written DDL
- [ ] 5.5 [db] Read the generated SQL and confirm it contains no `DROP`, `DELETE`, or `TRUNCATE`. It must be additive and forward-only
- [ ] 5.6 [db] Apply it, then verify: a second run applies nothing and exits 0; a revert executes `down` and removes the row from `migrations`; re-apply leaves the schema as before

Verify: `pnpm migration:run && pnpm migration:run && pnpm migration:revert && pnpm migration:run && docker compose exec -T db psql -U clarivo -d clarivo -c "TABLE migrations;"`

## 6. Global exception filter [req-7]
Registered before section 7 so the `ValidationPipe`'s own 400s already come back in the documented envelope.
- [ ] 6.1 [backend] New `src/common/filters/all-exceptions.filter.ts` — `@Catch()` `AllExceptionsFilter implements ExceptionFilter`, emitting `{ statusCode, code, message, details?, path, timestamp }`
- [ ] 6.2 [backend] Branch on `HttpException` — preserve its status and message; carry `class-validator` messages into `details`
- [ ] 6.3 [backend] Branch on TypeORM `QueryFailedError`, mapping `driverError.code`: `23505` → 409 `CONFLICT`, `23503` → 409 `CONFLICT`, `23502` → 400 `VALIDATION_ERROR`, `22P02` → 400 `VALIDATION_ERROR`. Anything unmapped falls through to 6.4
- [ ] 6.4 [backend] Everything else → 500, `code: INTERNAL_ERROR`, generic `"Internal server error"`. **The response must carry no driver message, no SQL, no stack** — the full cause goes to the logger only. 5xx logged at `error` with the cause, 4xx at `warn` without a stack
- [ ] 6.5 [backend] Register `app.useGlobalFilters(new AllExceptionsFilter())` in `src/main.ts`
- [ ] 6.6 [test] New `test/error-envelope.e2e-spec.ts` — unmatched route → 404 in envelope shape with all five fields; a thrown 403 `HttpException` keeps status and message; a duplicate insert on a unique index → 409 `CONFLICT`; an FK violation → 409; a malformed uuid → 400; a deliberately thrown `Error` → 500 whose body contains neither the original message nor `"select"`/`"insert"`/stack text

Verify: `pnpm test:e2e test/error-envelope.e2e-spec.ts`

## 7. Global validation pipe [req-6]
- [ ] 7.1 [backend] Register in `src/main.ts`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }))`
- [ ] 7.2 [backend] `enableImplicitConversion` stays **off** — each DTO declares `@Type(() => Number)` explicitly. Implicit coercion turns a malformed value into a plausible wrong one instead of a 400
- [ ] 7.3 [test] Extend `test/app.e2e-spec.ts` with a throwaway POST route and DTO — an undeclared property → 400 naming it; a wrong-typed declared property → 400; a valid body reaches the handler as a DTO **instance** (not a plain object); a string for a numeric field with no explicit transform → 400

Verify: `pnpm test:e2e test/app.e2e-spec.ts`

## 8. Base DTOs [req-5]
- [ ] 8.1 [backend] New `src/common/dto/pagination-query.dto.ts` — `PaginationQueryDto`: `page` (`@Type(() => Number)` `@IsInt` `@Min(1)`, default 1), `limit` (`@Type(() => Number)` `@IsInt` `@Min(1)` `@Max(100)`, default 20), `sortBy` (optional string), `order` (`@IsIn(['ASC','DESC'])`, uppercased by transform, default `DESC`)
- [ ] 8.2 [backend] Document on `sortBy`, in a comment, that the base class deliberately provides **no** query-building helper for it: a column name cannot be parameterized, so every endpoint must map `sortBy` through its own allowlist. A shared helper here would be an injection sink reachable from every list endpoint (see `design.md`)
- [ ] 8.3 [backend] New `src/common/dto/base-response.dto.ts` — `BaseResponseDto` exposing `id`, `createdAt`, `updatedAt` via `@Expose`
- [ ] 8.4 [backend] New `src/common/dto/paginated-response.dto.ts` — `PaginatedResponseDto<T>` as `{ items: T[], meta: { page, limit, total, totalPages, hasNext, hasPrev } }`, with `meta` derived from page/limit/total in one place rather than at each call site
- [ ] 8.5 [test] New `src/common/dto/pagination-query.dto.spec.ts` — `?page=2&limit=10` coerces to numbers; omitted params default to 1 / 20; `limit=1000` fails validation and is **not** clamped; `page=0` fails; `order=sideways` fails; `order=asc` normalizes to `ASC`; meta for page 2 of 25 at limit 10 gives `totalPages` 3, `hasNext` true, `hasPrev` true

Verify: `pnpm test src/common/dto/pagination-query.dto.spec.ts`

## 9. Backend container image [req-8]
- [ ] 9.1 [infra] New `.dockerignore` — `node_modules`, `dist`, `.env`, `*.log`, `.git`, `test`, coverage output
- [ ] 9.2 [infra] New multi-stage `Dockerfile` on `node:26-alpine`: deps stage (`pnpm install --frozen-lockfile`) → build stage (`pnpm build`) → runtime stage (`pnpm install --prod --frozen-lockfile` + `dist/` only)
- [ ] 9.3 [infra] Pin the pnpm version explicitly via `corepack`. `package.json` has **no** `packageManager` field — unlike `frontend/package.json:22` — so the image cannot infer one and an unpinned `pnpm` would drift
- [ ] 9.4 [infra] Include `dist/database/migrations/` in the runtime stage so the one-off migrate command can run from the same image
- [ ] 9.5 [infra] `USER node` — the official image already provides it. **`CMD` starts the server only; it must not run migrations** (concurrent replicas would race the same migration)
- [ ] 9.6 [infra] Confirm `CMD` matches the build output path. `nest build` uses `tsconfig.build.json` (`rootDir: ./src`) and emits `dist/main.js`; building with the base `tsconfig.json` (`rootDir: .`) emits `dist/src/main.js` instead — `context/rules.md` records this trap
- [ ] 9.7 [infra] Add the backend as a service in the root `docker-compose.yml`, `depends_on` the db's healthcheck
- [ ] 9.8 [test] Build the image and assert: build succeeds; a container answers `GET /`; `id -u` inside is non-zero; no `.ts` source and no devDependencies are present

Verify: `docker compose build backend && docker compose up -d && sleep 5 && curl -fsS localhost:3000/ && docker compose exec -T backend id -u && docker compose exec -T backend sh -c 'ls dist/main.js && ! ls src 2>/dev/null'`
