# Clarivo

Project knowledge platform. A **NestJS** backend (REST + Swagger, Postgres via TypeORM, JWT auth, on-disk file storage, AI-assisted context extraction) and a **Next.js** frontend (App Router).

```
backend/    NestJS API        → http://localhost:3000  (Swagger at /docs)
frontend/   Next.js app       → http://localhost:3001
docker-compose.yml            Postgres 17 (driven by backend/.env)
```

## Prerequisites

- **Node** ≥ 20
- **pnpm** (`npm i -g pnpm`)
- **Docker** (for Postgres) — or your own Postgres 17
- An **OpenAI-compatible AI key** (reference provider: [OpenRouter](https://openrouter.ai)). Required — the backend will not boot without it.

## Onboarding (first run)

### 1. Backend

```bash
cd backend
cp .env.example .env         # then edit — see "Environment" below
pnpm install
pnpm db:up                   # starts Postgres in Docker on DATABASE_PORT
pnpm migration:run           # creates the schema
pnpm seed                    # creates the admin account from SEED_ADMIN_*
pnpm start:dev               # API on :3000, Swagger on :3000/docs
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL defaults to http://localhost:3000
pnpm install
pnpm dev                     # app on :3001
```

### 3. Log in

Open http://localhost:3001 and sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set in `backend/.env`.

## Environment

Copy the tracked templates and fill them in. **No real secrets are committed.**

**`backend/.env`** (from `.env.example`) — the ones with no default that block boot if unset:

| Variable | What it is |
|---|---|
| `DATABASE_*` | Postgres connection. `docker-compose` reads these too, so one source of truth. |
| `JWT_SECRET` | Session signing key — long random string. **No default.** |
| `FILE_STORAGE_PATH` | Root dir for uploaded files (e.g. `./storage`). **No default.** |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STRONG` | OpenAI-compatible provider for document summarisation + knowledge proposals. **All four required.** |
| `SEED_ADMIN_*` | Account created by `pnpm seed`. |

**`frontend/.env.local`** (from `.env.example`): `NEXT_PUBLIC_API_URL` — the backend URL.

## Common commands

**Backend** (`cd backend`)

| Command | Does |
|---|---|
| `pnpm start:dev` | API with watch |
| `pnpm db:up` / `pnpm db:down` | Start / stop Postgres container |
| `pnpm migration:run` / `:revert` / `:show` | Apply / roll back / list migrations |
| `pnpm migration:generate src/database/migrations/<Name>` | Generate a migration from entity changes |
| `pnpm seed` | Seed the admin (+ optional member) account |
| `pnpm test` / `pnpm test:e2e` | Unit / e2e tests (Vitest) |
| `pnpm lint` | oxlint |

**Frontend** (`cd frontend`)

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on :3001 |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm api:types` | Regenerate `types/api` from the backend's OpenAPI spec (run while the backend is up) |
| `pnpm lint` | ESLint |

## Notes

- **Frontend API types are generated**, not hand-written. After changing a backend DTO/endpoint, run `pnpm api:types` in `frontend/` (backend must be running) to refresh `frontend/types/api`.
- **Routes** live under `frontend/app/(app)/` — `(app)` is a route group, so it shapes layout without changing URLs (`/projects` stays `/projects`).
- `DATABASE_PORT` defaults to `5437` in the example because `5432` is often held by a native Postgres install. Change if you like.
