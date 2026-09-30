# Design: add-login

Grounded in `devspec/context/` (summary, conventions, patterns, rules, schema) and `db.md`.

## Architecture

```
  browser (localhost:3001)                     nest api (localhost:3000)
 ┌───────────────────────────┐               ┌─────────────────────────────────────┐
 │ app/(auth)/login/page.tsx │               │ AuthModule                          │
 │   useMutation ──────────────POST /auth/login──▶ AuthController.login()          │
 │   {email,password,remember}               │      │ UsersService.findByEmail()   │
 │                           │               │      │ argon2.verify(hash, pw)      │
 │                           │               │      │ JwtService.sign({sub,email}) │
 │   Set-Cookie: clv_at  ◀─────────────────────────┘ res.cookie(httpOnly, lax,     │
 │     httpOnly · sameSite=lax               │           maxAge = remember?30d:—)  │
 │     maxAge 30d | session                  │                                     │
 │                           │               │ AuthController.logout()             │
 │ middleware.ts             │               │   res.clearCookie('clv_at')         │
 │   cookie absent → 307 /login              │                                     │
 │                           │  GET /auth/me │ JwtAuthGuard → JwtStrategy          │
 │ lib/api.ts (axios,        │◀─────────────▶│   cookie extractor (NOT header)     │
 │   withCredentials: true)  │               │   → UserDto {id,email,name,...}     │
 └───────────────────────────┘               └──────────────┬──────────────────────┘
                                                            │ TypeORM
                                                     ┌──────▼──────┐
                                                     │ users table │  ← first migration
                                                     └─────────────┘
                                             seed: pnpm seed → upsert 1 admin from env
```

## Decisions

### Session transport — httpOnly cookie, not a bearer header
`frontend/app/lib/api.ts:3` already sets `withCredentials: true`, and Next.js middleware can read a cookie but cannot read `localStorage`. A cookie is therefore the only transport that lets route protection work server-side. It also keeps the token out of reach of XSS.

`localhost:3000` and `localhost:3001` are the **same site** — port is not part of a site — so `SameSite=Lax` works across them in development with no `SameSite=None` or HTTPS requirement.

**Consequence**: `backend/src/main.ts:33` declares `.addBearerAuth()` in the Swagger builder. That is now wrong and must become `.addCookieAuth('clv_at')`, or every future endpoint documents an auth scheme the API does not use (`rules.md` already flags this contradiction).

### One token, no refresh pair
A single JWT with a 30-day expiry. `remember` controls only whether the **cookie** persists past browser close; the token's `exp` is the same either way.

**Rejected — access + refresh rotation**: correct, and roughly three times the code — a `/auth/refresh` endpoint, rotation, reuse detection, and a 401-retry interceptor in Axios. The upgrade is purely additive (no schema change, no data migration), so it can land the day this becomes customer-facing.
**Rejected — short `exp` when "remember" is unchecked**: a one-hour token logs the user out in the middle of a two-hour meeting, which is precisely what this product is used during.

**Accepted ceiling**: no revocation. A leaked cookie is valid for its full 30 days.

### Password hashing — argon2id
`argon2` (the `node-argon2` binding), default parameters. Chosen over bcrypt for its memory-hardness and because it has no 72-byte input truncation. The encoded hash is ~97 characters, comfortably inside `varchar(255)`.

### Email case — lowercase in the service, not `citext`
`citext` is available in this Postgres image but not installed. Using it would mean a `CREATE EXTENSION` inside the first migration and a non-standard column type. Instead the service lowercases the email before both insert and lookup, and the plain unique index does the work. Recorded in `db.md` as the settled default.

### Seed as a script, not a migration
A seed migration would have to embed a pre-computed hash, committing a real credential to git history permanently. The script reads `SEED_ADMIN_*` from the environment, hashes at run time, and upserts by email so it is rerunnable. Costs one `pnpm` script; saves a credential leak that cannot be undone.

### Generic authentication failure
A wrong email and a wrong password return the identical `AUTH_INVALID_CREDENTIALS` / 401. Distinguishing them turns the login form into an account-existence oracle. The UI renders one banner and marks neither field invalid (`ui.md`).

### Module layout — first domain modules in the repo
`backend/src/` is currently role-first (`config/`, `common/`, `database/`, `filters/`) because no domain module exists. This change adds the first two, `src/users/` and `src/auth/`, following NestJS convention. Everything after copies this, so it is a precedent, not just a placement.

### Conventions this change is bound by
| Rule | Where it applies here |
|------|----------------------|
| Relative imports only — no `@/*` alias in the backend | every new backend file |
| Single quotes, `trailingComma: all` (backend) / double quotes (frontend) | the two sides format oppositely; don't unify |
| CommonJS — no ESM-only deps, no top-level `await` | `argon2`, `passport-jwt`, `cookie-parser` all ship CJS |
| `@Expose()` opt-in serialization (`common/dtos/audit.dto.ts:5`) | `password_hash` gets **no** `@Expose()` and never appears in a response DTO |
| `defineErrors('DOMAIN', {...})` (`common/exceptions/domain-errors.ts:21`) | `AuthErrors.INVALID_CREDENTIALS` etc. — never a bare `HttpException` |
| Every env var added to `EnvironmentVariables` **and** `.env.example` | `JWT_SECRET`, `JWT_EXPIRES_IN`, `SEED_ADMIN_*` |
| `synchronize: false` everywhere (`config/database.config.ts:25`) | schema changes only via a forward migration |
| Entity glob `**/*.entity{.ts,.js}` | the file **must** be named `user.entity.ts` or TypeORM will not see it |
| shadcn CLI hangs in this environment (`rules.md`) | `input` / `label` / `checkbox` are copied in by hand |

## Impact Area

### 1. Decision Defaults

| Gray area | Default decision | Fallback if the default doesn't fit |
|-----------|------------------|-------------------------------------|
| Cookie name | `clv_at` | any single stable name — it appears in `main.ts`, the strategy and the middleware; keep the three in sync |
| Cookie flags | `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: NODE_ENV === 'production'` | — |
| "Remember me" lifetime | 30 days (`maxAge: 30 * 24 * 60 * 60 * 1000`); unchecked omits `maxAge` entirely → session cookie | — |
| JWT payload | `{ sub: user.id, email: user.email }` — nothing else | never put `name` or any PII beyond email in the token |
| JWT expiry | `JWT_EXPIRES_IN` env, default `30d`, matching the remembered cookie | — |
| Where the modules live | `backend/src/users/` and `backend/src/auth/`, NestJS-conventional | mirror whichever domain module exists by then |
| Backend file naming | `user.entity.ts`, `auth.controller.ts`, `login.dto.ts`, `jwt-auth.guard.ts` | follow the `*.role.ts` suffix pattern in `conventions.md` |
| Error codes | `defineErrors('AUTH', { INVALID_CREDENTIALS, UNAUTHENTICATED })` → `AUTH_INVALID_CREDENTIALS` | — |
| Error copy | "Incorrect email or password." — sentence case, full stop, identical for both causes | — |
| Login route path | `frontend/app/(auth)/login/page.tsx` — route group keeps the auth layout separate without a URL segment | plain `app/login/page.tsx` if the route group fights Next 16 typed routes |
| Redirect after login | `/` | if a `?next=` param is present and is a relative path, honour it; **reject absolute URLs** (open-redirect) |
| Redirect when unauthenticated | 307 to `/login` | — |
| Form state management | local `useState` + a TanStack `useMutation`; no form library | `react-hook-form` only if the field count grows past this screen |
| Client-side validation | email non-empty and matches a basic address shape; password non-empty. Nothing stronger — the server is the authority | — |
| Missing UI components | copy `input`, `label`, `checkbox` from ui.shadcn.com by hand into `app/components/ui/` (the CLI hangs — `rules.md`) | if the CLI works by then, use it |
| `cn` import in new components | `@/lib/utils` per `components.json` | note `button.tsx:3` imports from the `cn` **npm package** instead — do **not** copy that; leave the existing line alone (out of scope) |
| Frontend dev port | pin to 3001 (`next dev -p 3001`) and set `CORS_ORIGINS=http://localhost:3001` | any port, as long as the two agree |
| Illustration format | WebP at ~1400px wide, PNG kept as the source in `assets/` | — |
| Illustration on phones | not requested at all below 900px — skip the render, don't just `display:none` | a `<picture>` with a media-query source |
| Unlisted edge case | fail closed: no cookie set, log server-side, return the standard error envelope | — |

### 2. Blast Radius

Resolved against the code graph and the file tree — the repo has no domain code, so almost everything here is new.

**Backend — new**
- `backend/src/users/user.entity.ts`, `users.service.ts`, `users.module.ts`
- `backend/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.errors.ts`, `jwt.strategy.ts`, `jwt-auth.guard.ts`, `dto/login.dto.ts`, `dto/user.dto.ts`
- `backend/src/database/migrations/<timestamp>-CreateUsers.ts`
- `backend/src/database/seeds/seed.ts`
- `users` table

**Backend — adjusted**
- `backend/src/app.module.ts` — register `UsersModule` + `AuthModule`
- `backend/src/main.ts:9` — add `cookieParser()`; swap `.addBearerAuth()` → `.addCookieAuth('clv_at')`
- `backend/src/config/env.validation.ts` — `JWT_SECRET`, `JWT_EXPIRES_IN`, `SEED_ADMIN_EMAIL/PASSWORD/NAME`
- `backend/.env`, `backend/.env.example` — the same vars, plus `CORS_ORIGINS`
- `backend/package.json` — `seed` script; deps `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `argon2`, `cookie-parser` (+ `@types/passport-jwt`, `@types/cookie-parser`)

**Frontend — new**
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/components/ui/input.tsx`, `label.tsx`, `checkbox.tsx`
- `frontend/middleware.ts` (project root — Next requires it outside `app/`)
- `frontend/public/clarivo-mark.png`, `frontend/public/login-background.webp`

**Frontend — adjusted**
- `frontend/package.json` — `dev`/`start` pinned to port 3001; dep `@radix-ui/react-checkbox`
- `frontend/app/types/api/types.gen.ts` — regenerated from the new endpoints (never hand-edited)

**Nothing existing reads or writes anything this change touches.** No repository, service, controller or query exists to regress; `users` is not shared with another feature because there is no other feature.

### 3. Risk + reversibility

```
backend/src/users/**                      — safe/reversible (new)
backend/src/auth/**                       — safe/reversible (new)
migrations/<ts>-CreateUsers.ts            — safe/reversible (additive, forward-only, empty DB)
backend/src/database/seeds/seed.ts        — safe/reversible (idempotent upsert, no delete)
backend/src/main.ts (cookieParser, swagger)— safe/reversible
backend/src/app.module.ts (register)      — safe/reversible
backend/src/config/env.validation.ts      — safe/reversible (new vars have defaults or are dev-only)
backend/.env + .env.example               — safe/reversible
frontend/app/(auth)/login/**              — safe/reversible (new)
frontend/middleware.ts                    — safe/reversible (new), but see below
frontend/package.json (port pin)          — safe/reversible
```

One entry deserves a reviewer's eye rather than a tag: **`frontend/middleware.ts` gates every route**. A matcher that is too broad locks the login page itself out and produces a redirect loop; one that is too narrow leaves pages open. The matcher must exclude `/login`, `/_next/*`, and static assets. It is trivially revertible, but it is the piece most likely to be wrong on the first run.

Nothing in this change is destructive. There is no `DROP`, no `DELETE`, no data reshape, and the database has no rows to lose.

## Open questions

None blocking. Two settled defaults worth re-reading before approval, because reversing either later is more expensive than deciding now:

1. **`citext` was rejected** in favour of application-level lowercasing (`db.md`). Switching later is an `ALTER TYPE` plus a dedupe pass.
2. **No refresh-token pair.** Accepted for an internal pre-launch tool; the upgrade path is additive and needs no migration.
