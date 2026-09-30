# Tasks: add-login

## 1. Environment contract and dependencies [req-8]
- [ ] 1.1 [backend] Add to `EnvironmentVariables` (`backend/src/config/env.validation.ts`): `JWT_SECRET` (`@IsString @IsNotEmpty`, no default), `JWT_EXPIRES_IN` (`@IsString`, default `'30d'`), `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` (`@IsString @IsNotEmpty`)
- [ ] 1.2 [backend] Mirror all five vars in `backend/.env.example` with placeholder values, and set real dev values in `backend/.env`
- [ ] 1.3 [backend] Set `CORS_ORIGINS=http://localhost:3001` in `backend/.env` and `.env.example` — replaces the current `http://localhost:3000,http://localhost:5173`, which lists the backend's own port and a dead Vite port
- [ ] 1.4 [frontend] Pin the dev port in `frontend/package.json`: `"dev": "next dev -p 3001"`, `"start": "next start -p 3001"` — Next currently collides with the backend on 3000 and silently bumps
- [ ] 1.5 [backend] `pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt argon2 cookie-parser` and `pnpm add -D @types/passport-jwt @types/cookie-parser` — all ship CommonJS, required by `rules.md`
- [ ] 1.6 [frontend] `pnpm add @radix-ui/react-checkbox`
Verify: `cd backend && pnpm build && pnpm start:dev` boots with the new vars validated; unsetting `JWT_SECRET` kills the process at boot

## 2. Users table and entity [req-1]
- [ ] 2.1 [db] New `User` entity at `backend/src/users/user.entity.ts` extending `BaseEntity` (`../database/base.entity`) — the filename **must** end in `.entity.ts` or the glob at `config/database.config.ts:21` will not see it. Columns: `email` `varchar(255)` unique not-null, `password_hash` `varchar(255)` not-null (`@Column({ name: 'password_hash' })`), `name` `varchar(255)` not-null. Table name `users`
- [ ] 2.2 [db] Generate the migration: `pnpm migration:generate src/database/migrations/CreateUsers` — **read the generated SQL** before running it; this is the first migration this repo has ever produced
- [ ] 2.3 [db] Apply it with `pnpm migration:run`
- [ ] 2.4 [backend] New `UsersService` (`backend/src/users/users.service.ts`) — `findByEmail(email: string)` lowercasing the argument before the query, and `upsertByEmail(...)` for the seed. New `UsersModule` (`users.module.ts`) importing `TypeOrmModule.forFeature([User])` and exporting `UsersService`
- [ ] 2.5 [backend] New `UserDto` (`backend/src/users/dto/user.dto.ts`) extending `AuditDto` from `../../common/dtos/audit.dto`, with `@Expose()` on `email` and `name` only — **no `@Expose()` on `password_hash`**, which is what keeps it out of every response
- [ ] 2.6 [test] `backend/src/users/users.service.spec.ts` — `findByEmail` lowercases its argument before querying
Verify: `docker exec clarivo-postgres-1 psql -U postgres -d clarivo -c "\d users"` shows all six columns with a unique index on `email`; `pnpm migration:revert` then `pnpm migration:run` round-trips cleanly

## 3. Seed script [req-2]
- [ ] 3.1 [backend] New `backend/src/database/seeds/seed.ts` — standalone script (boots its own `DataSource` from `database/data-source.ts`, the CLI runs outside Nest), hashes `SEED_ADMIN_PASSWORD` with argon2id and upserts by lowercased `SEED_ADMIN_EMAIL`. No hardcoded credential anywhere in the file
- [ ] 3.2 [backend] Add `"seed": "pnpm build && node dist/database/seeds/seed.js"` to `backend/package.json` scripts, matching how the `migration:*` scripts build first
- [ ] 3.3 [test] `backend/src/database/seeds/seed.spec.ts` — hashing a password produces a verifiable argon2 hash, and the same email upserts rather than inserting twice
Verify: `pnpm seed && pnpm seed` then `docker exec clarivo-postgres-1 psql -U postgres -d clarivo -tAc "select count(*) from users"` returns `1`

## 4. Login and logout endpoints [req-3] [req-4] [req-5] [req-7]
- [ ] 4.1 [backend] New `backend/src/auth/auth.errors.ts` — `defineErrors('AUTH', { INVALID_CREDENTIALS: { status: HttpStatus.UNAUTHORIZED, message: 'Incorrect email or password' }, UNAUTHENTICATED: { status: HttpStatus.UNAUTHORIZED, message: 'Not authenticated' } })`, following `common/exceptions/domain-errors.ts:21`. Never throw a bare `HttpException`
- [ ] 4.2 [backend] New `LoginDto` (`backend/src/auth/dto/login.dto.ts`) — `email` `@IsEmail`, `password` `@IsString @IsNotEmpty`, `remember` `@IsBoolean @IsOptional` default `false`. The global pipe runs `forbidNonWhitelisted`, so any extra field is already a 400
- [ ] 4.3 [backend] New `AuthService` (`backend/src/auth/auth.service.ts`) — `validate(email, password)` looks the user up via `UsersService.findByEmail`, verifies with `argon2.verify`, and throws `AuthErrors.INVALID_CREDENTIALS()` for **both** a missing user and a bad password so the two are indistinguishable; `sign(user)` issues `{ sub, email }` via `JwtService`
- [ ] 4.4 [backend] New `AuthController` (`backend/src/auth/auth.controller.ts`) — `POST /auth/login` sets the cookie `clv_at` with `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure` only in production, and `maxAge: 30 days` **only when `remember` is true** (omitted entirely otherwise, which is what makes it a session cookie); returns a `UserDto`
- [ ] 4.5 [backend] `POST /auth/logout` on the same controller — `res.clearCookie('clv_at', { path: '/' })`, returns 200
- [ ] 4.6 [backend] New `AuthModule` (`backend/src/auth/auth.module.ts`) registering `JwtModule` with `JWT_SECRET` / `JWT_EXPIRES_IN` from `ConfigService`, importing `UsersModule`; register `UsersModule` and `AuthModule` in `backend/src/app.module.ts`
- [ ] 4.7 [backend] `backend/src/main.ts` — `app.use(cookieParser())` before the global pipe, and change `.addBearerAuth()` to `.addCookieAuth('clv_at')` in the `DocumentBuilder`, since the API no longer uses a bearer header
- [ ] 4.8 [test] `backend/src/auth/auth.service.spec.ts` — unknown email and wrong password throw the **same** error code; a correct password returns the user
Verify: `pnpm test` passes, and `curl -i -X POST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"<seed>","password":"<seed>","remember":true}'` returns 200 with a `Set-Cookie: clv_at=…; Max-Age=2592000; HttpOnly; SameSite=Lax`; the same call with a wrong password and with an unknown email return byte-identical 401 bodies; omitting `remember` yields a `Set-Cookie` with no `Max-Age`

## 5. Session guard and current-user endpoint [req-6]
- [ ] 5.1 [backend] New `JwtStrategy` (`backend/src/auth/jwt.strategy.ts`) — a passport-jwt strategy whose `jwtFromRequest` is a **custom cookie extractor reading `req.cookies['clv_at']`**, not `ExtractJwt.fromAuthHeaderAsBearerToken()`; `validate(payload)` loads the user by `payload.sub` and throws `AuthErrors.UNAUTHENTICATED()` if the row is gone
- [ ] 5.2 [backend] New `JwtAuthGuard` (`backend/src/auth/jwt-auth.guard.ts`) extending `AuthGuard('jwt')`
- [ ] 5.3 [backend] `GET /auth/me` on `AuthController`, decorated with `@UseGuards(JwtAuthGuard)`, returning the request's user as a `UserDto`
- [ ] 5.4 [test] `backend/src/auth/jwt.strategy.spec.ts` — the extractor returns the cookie value when present and `null` when absent
Verify: `curl -i --cookie "clv_at=<token>" localhost:3000/auth/me` returns 200 with `id`, `email`, `name` and **no** `password_hash`; the same call with no cookie, a truncated token, and an expired token each return 401

## 6. Frontend form components [req-9]
- [ ] 6.1 [frontend] Add `frontend/app/components/ui/input.tsx` (`Input`), `label.tsx` (`Label`) and `checkbox.tsx` (`Checkbox`) by **copying the source from ui.shadcn.com by hand** — the shadcn CLI hangs in this environment (`rules.md`). Match `components.json`: new-york style, CSS variables, `@/lib/utils` for `cn`
- [ ] 6.2 [frontend] Copy the assets into `frontend/public/`: `clarivo-mark.png` from `devspec/changes/add-login/mockups/clarivo-mark.png` (the mark alone — `clarivo-logo.png` is the stacked lockup and cannot sit beside a text wordmark), and a WebP conversion of `assets/login-background.png` as `login-background.webp` at ~1400px wide
Verify: `cd frontend && pnpm build` compiles with the three new components imported

## 7. Login screen [req-9] [req-10]
- [ ] 7.1 [frontend] New route `frontend/app/(auth)/login/page.tsx` built to `mockups/login.html` — one centred card, `max-width: 440px` on phones and `452px` from 640px, splitting into a two-panel grid at 900px with the illustration `object-fit: contain` and centred in the left panel. Brand area is the logo alone below 900px
- [ ] 7.2 [frontend] Reuse `<Button>` from `@/components/ui/button` (`variant="default"`) for Sign in — **not** a new button; reuse the new `<Input>`, `<Label>` and `<Checkbox>`. Leading `Mail` and `Lock` icons and the `Eye`/`EyeOff` toggle come from `lucide-react`, already installed
- [ ] 7.3 [frontend] Mobile rules from `ui.md`: inputs and button 50px tall (46px at ≥900px), input `font-size: 16px` to stop iOS Safari zooming on focus, eye toggle 44×44, the whole "Remember me" label a 44px tap target, `env(safe-area-inset-bottom)` in the bottom padding, `inputmode="email"`, and `autocomplete="email"` / `"current-password"`
- [ ] 7.4 [frontend] Do **not** request the illustration below 900px — `display:none` still downloads it; use a conditional render or a `<picture>` with a media-query source. The file is 1.4 MB as a PNG
- [ ] 7.5 [frontend] Wire submission with a TanStack `useMutation` calling `api.post('/auth/login', { email, password, remember })` through `@/lib/api` (which already sends credentials). Local `useState` for the fields — no form library
- [ ] 7.6 [frontend] States per `ui.md`: client-side validation blocks the request and marks the offending field with `aria-invalid`; while in flight, inputs, checkbox and button are disabled and the button shows a spinner; a 401 renders one banner reading "Incorrect email or password." above the fields with neither field marked invalid and the values preserved; success calls `router.push('/')`
- [ ] 7.7 [frontend] Regenerate API types: with the backend running, `pnpm api:types`. Never hand-edit `app/types/api/`
Verify: `/devspec-verify add-login` — agent-browser drives the running app and checks the regions exist, the styling is not browser-default, the layout is aligned at 390px and at desktop, and each state renders

## 8. Route protection [req-11]
- [ ] 8.1 [frontend] New `frontend/middleware.ts` at the **project root**, not under `app/` — redirects to `/login` when the `clv_at` cookie is absent
- [ ] 8.2 [frontend] Matcher must exclude `/login`, `/_next/*`, `/favicon.ico` and `/public` assets. Too broad and the login page redirects to itself in a loop; this is the single most likely thing in the change to be wrong on the first run
Verify: `/devspec-verify add-login` — visiting `/` with no cookie lands on `/login`; visiting `/login` with no cookie renders without redirecting; signing in and revisiting `/` renders the page

## 9. End-to-end proof [req-3] [req-6] [req-7] [req-8]
- [ ] 9.1 [test] `backend/test/auth.e2e-spec.ts` (vitest e2e config) — seed a user, log in, reuse the returned cookie against `GET /auth/me`, log out, confirm the next `GET /auth/me` is 401
- [ ] 9.2 [test] Same file: a preflight `OPTIONS /auth/login` sent with `Origin: http://localhost:3001` answers `Access-Control-Allow-Credentials: true` and echoes that origin
Verify: `cd backend && pnpm test:e2e`
