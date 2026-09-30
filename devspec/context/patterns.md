# Patterns

Recurring solutions already in this codebase. Copy these shapes rather than inventing new ones.

## Domain errors — declare per domain, throw by name
One `defineErrors('<DOMAIN>', {...})` call per domain produces factories whose code is `DOMAIN_KEY`. Never `throw new HttpException` directly in domain code.
`backend/src/common/exceptions/domain-errors.ts:21`
```ts
export const ProjectErrors = defineErrors('PROJECT', {
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Project not found' },
});
throw ProjectErrors.NOT_FOUND({ id });   // → code: PROJECT_NOT_FOUND
```

## Error envelope — one shape for every failure
A single catch-all filter maps `AppException` → its own code, other `HttpException` → the status name, anything else → `INTERNAL_SERVER_ERROR` with the real message swallowed. 5xx is logged, 4xx is not. Response body is always `{statusCode, code, message, details?, path, timestamp}`.
`backend/src/filters/app-exception.filter.ts:36`

## Env access — validated class, never raw process.env
Env is a decorated class validated at boot; readers use the typed `ConfigService` with `{ infer: true }`. `database.config.ts` calls `validate()` itself because the TypeORM CLI boots outside Nest.
`backend/src/config/env.validation.ts:22` · consumed at `backend/src/main.ts:11` · CLI path `backend/src/config/database.config.ts:7`

## Entity base — uuidv7 PK + audit timestamps
Every table extends `BaseEntity`: `id` uuid generated in the app via `@BeforeInsert` (Postgres 17 has no `uuidv7()`), plus `created_at`/`updated_at` as `timestamptz`.
`backend/src/database/base.entity.ts:9`

## Response DTO — mirror the entity, opt fields in
`AuditDto` is the response-side twin of `BaseEntity`. Entity DTOs extend it and `@Expose()` each field they want serialized; anything unexposed cannot leak.
`backend/src/common/dtos/audit.dto.ts:5`

## Composable query DTOs — nest, don't flatten
`PaginationDto` and `SortDto` are nested as `pagination` / `sort` on a domain query DTO rather than spread flat. `PaginationDto.skip` is a getter, so services read `dto.pagination.skip` directly.
`backend/src/common/dtos/pagination.dto.ts:5` · `backend/src/common/dtos/sort.dto.ts:6`

## Barrel exports in common/
Each `common/` subfolder has an `index.ts`; `src/common/index.ts` re-exports them. Import shared pieces from the barrel, and add new files to it.
`backend/src/common/index.ts:1`

## Frontend provider — client component holding a state-pinned client
Providers are `"use client"` and hold their instance in `useState(() => new X())` so Fast Refresh and SSR never share one.
`frontend/app/components/provider/query-provider.tsx:8`

## Frontend HTTP — one Axios instance, cookies on
All requests go through the single exported `api` instance. `withCredentials: true` is already set, so the app is pre-wired for cookie-based sessions.
`frontend/app/lib/api.ts:3`

## `ponytail:` comments mark deliberate simplifications
A `ponytail:` comment means "this is intentionally the small version" and names the ceiling. Keep them; add one when you take a knowing shortcut.
`frontend/app/components/provider/query-provider.tsx:7`
