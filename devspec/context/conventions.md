# Conventions

> Two codebases, separate toolchains, **different formatting rules**. Neither ships its own `CLAUDE.md` or `.claude/rules/` — the repo-root `.claude/` holds DevSpec skills only, no code rules. Everything below is read off config and existing source.

## Backend — `backend/`

| Area | Standard |
|------|----------|
| **Naming** | Files kebab-case + role suffix: `*.entity.ts`, `*.dto.ts`, `*.module.ts`, `*.filter.ts`, `*.config.ts`, `*.spec.ts` (`src/common/dtos/pagination.dto.ts`, `src/filters/app-exception.filter.ts`). Classes PascalCase matching the file (`PaginationDto`, `AppExceptionFilter`) |
| **Layout** | Role-first at `src/` top level — `config/`, `common/`, `database/`, `filters/`. `common/` is split into `dtos/` and `exceptions/`, each with an `index.ts` barrel, re-exported by `src/common/index.ts:1`. Domain modules do not exist yet; the first one sets the precedent |
| **Imports** | **Relative paths only** — no `@/*` alias is configured in `backend/tsconfig.json`. Node builtins use the `node:` prefix (`src/config/database.config.ts:1`). `import type` for type-only imports (`src/filters/app-exception.filter.ts:9`) |
| **Module system** | CommonJS (`"type": "commonjs"`), `module: nodenext`. Do not add ESM-only deps or top-level `await` |
| **Format** | `backend/.prettierrc` — **single quotes**, `trailingComma: all`. Defaults otherwise (printWidth 80) |
| **Lint** | oxlint, `backend/.oxlintrc.json` — `no-explicit-any` **off**, `no-floating-promises` **error** (hence `void bootstrap()` at `src/main.ts:44`). Type-aware: `pnpm lint` runs `oxlint --type-aware` |
| **TS** | `strict: true` but `strictPropertyInitialization: false` — DTO/entity fields are declared bare, no `!` needed (`src/config/env.validation.ts:23`) |
| **Tests** | vitest, globals on, `reflect-metadata` in setupFiles (`vitest.config.mts`). Spec files sit **next to the source**, not in `test/` (`src/common/exceptions/domain-errors.spec.ts`). Config files are `.mts` |
| **API / validation** | Global `ValidationPipe` with `transform`, `whitelist`, `forbidNonWhitelisted`, and `enableImplicitConversion: false` (`src/main.ts:18`) — so every DTO field needing coercion declares `@Type(() => Number)` explicitly (`src/common/dtos/pagination.dto.ts:6`) |
| **API / responses** | Response DTOs extend `AuditDto` and mark fields `@Expose()` (`src/common/dtos/audit.dto.ts:5`). A field with no `@Expose()` does not ship — this is the mechanism that keeps secrets out of responses |
| **API / query params** | Paging and sorting are **nested objects**, not flat: `?pagination[page]=2&sort[sortOrder]=ASC`. Compose by nesting `PaginationDto`/`SortDto` on the query DTO (`src/common/dtos/pagination.dto.ts:4`) |
| **API / docs** | Swagger CLI plugin with `introspectComments: true` (`nest-cli.json`) — **JSDoc comments become Swagger descriptions**; `@ApiProperty` is rarely needed. Controllers are auto-tagged (`autoTagControllers: true`, `src/main.ts:36`) |
| **Env** | Every new env var is added to `EnvironmentVariables` in `src/config/env.validation.ts` with class-validator decorators and a default where sensible, **plus** a row in `.env.example`. Nothing reads `process.env` directly outside that file and `database.config.ts` |
| **Commits** | Conventional Commits, lowercase: `feat: add backend foundation with environment validation, …` (`git log`). No enforcement tooling |

## Frontend — `frontend/`

| Area | Standard |
|------|----------|
| **Naming** | Files kebab-case (`query-provider.tsx`, `button.tsx`); exported components PascalCase (`QueryProvider`) |
| **Layout** | **Everything lives under `app/`** — there is no `src/`. Route files and non-route code are collocated: `app/components/ui/` (shadcn), `app/components/provider/`, `app/lib/` (flat utilities — `api.ts`, `utils.ts`, no subfolders), `app/types/api/` (generated) |
| **Imports** | Alias `@/*` → `./app/*` (`frontend/tsconfig.json`). Use `@/components/...`, `@/lib/...` — not relative walks |
| **Format** | **No prettier config** — existing code is Next.js default: **double quotes**, 2-space. Opposite of the backend; don't unify one side to the other by accident |
| **Lint** | eslint flat config extending `eslint-config-next/core-web-vitals` + `/typescript` (`eslint.config.mjs`) |
| **Components** | shadcn/ui, style `new-york`, baseColor slate, CSS variables, RSC on, lucide icons (`components.json`). **The shadcn CLI does not work in this environment** — it hangs at "Installing dependencies". Add components by copying the source from ui.shadcn.com into `app/components/ui/` by hand and installing any radix dep with pnpm |
| **Client boundary** | Server Components by default; `"use client"` only where hooks/state are needed, and pushed as low as possible (`app/components/provider/query-provider.tsx:1`) |
| **Styling** | Tailwind v4 via `@import "tailwindcss"` in `app/globals.css` — **no `tailwind.config.js`**. Theme is OKLCH CSS variables on `:root` / `.dark`, seeded from the Clarivo logo (blue `#3A75FD`, navy `#16213D`). Use the semantic tokens (`bg-background`, `text-foreground`, `border-input`, `ring`) — never raw hex in components |
| **Data fetching** | TanStack Query for client state; the Axios instance at `app/lib/api.ts` is the only HTTP entry (`withCredentials: true`, base URL from `NEXT_PUBLIC_API_URL`). Query defaults: `staleTime: 60s`, no refetch-on-focus |
| **API types** | `app/types/api/` is generated by `pnpm api:types` from the live backend `/docs-json` (`openapi-ts.config.ts`). **Types only — no SDK**; requests still go through `app/lib/api.ts`. Never hand-edit files in that folder |
| **Tests** | None configured. No test runner installed |
