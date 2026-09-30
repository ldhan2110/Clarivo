# Conventions

> Greenfield: intended, not yet built. Refresh after first real code.
> Two independent packages, rules differ per side. Neither ships its own `CLAUDE.md` or `.claude/rules/` — the repo root's `.claude/` holds DevSpec workflow files only, not code standards. So there is nothing authoritative to index; every rule below traces to a config file or a scaffold file, and rows marked *(not observable)* have no evidence yet.

## Backend — `backend/`
**Authoritative**: none (no package-level `CLAUDE.md` / `.claude/rules/`)

| Area | Standard |
|------|----------|
| **Module system** | **Native ESM** — `package.json:8` `"type": "module"`, `tsconfig.json` `module`/`moduleResolution: "nodenext"`. Every relative import carries an explicit `.js` extension, even from `.ts` source: `import { AppService } from './app.service.js'` (`src/app.controller.ts:2`). Omitting it fails at runtime. `__dirname`/`__filename` do not exist — use `import.meta.dirname`. |
| **Decorators** | Legacy TS decorators, not stage-3 — `tsconfig.json` sets `experimentalDecorators: true` + `emitDecoratorMetadata: true`. Verified: TS 6.0.3 still emits `design:type` metadata under these flags, so decorator-metadata-dependent libraries (Nest DI, `class-validator`, TypeORM) work. Do not switch to stage-3 decorators. |
| **Naming** | Nest conventions — classes PascalCase with role suffix (`AppController`, `AppService`); files kebab/dot-cased by role: `<name>.controller.ts`, `<name>.service.ts`, `<name>.module.ts`, `<name>.spec.ts`, `<name>.e2e-spec.ts` |
| **Layout** | Feature modules under `src/modules/<feature>/`, one folder per feature (`src/modules/authentication/` is the seeded, still-empty example). Root wiring stays in `src/app.module.ts`; bootstrap in `src/main.ts`. |
| **Imports** | No path aliases configured in `tsconfig.json` — relative imports only. `vitest.config.ts:7` loads `vite-tsconfig-paths`, so aliases would resolve in tests if added later, but none exist today. |
| **Format** | `.prettierrc`: `singleQuote: true`, `trailingComma: "all"`. Defaults otherwise (no `printWidth`/`semi` override → 80 cols, semicolons on). |
| **Lint** | `.oxlintrc.json` — oxlint, not ESLint. `typescript/no-explicit-any: "off"` (so `any` is permitted), `typescript/no-floating-promises: "error"` (every promise must be awaited or explicitly voided). `env.node: true`. Run type-aware: `oxlint --type-aware src/ test/`. |
| **Strictness** | `strict: true` but `strictPropertyInitialization: false` (`tsconfig.json`) — declared-but-unassigned class properties are allowed, which is what lets decorator-initialized fields (DTO/entity properties) compile without `!`. |
| **Tests** | vitest 4, `globals: true` (`vitest.config.ts:10`) so `describe`/`it`/`expect` need no import; `types: ["vitest/globals", "node"]` in tsconfig. Unit specs `**/*.spec.ts` beside the source (`src/app.controller.spec.ts`); e2e `**/*.e2e-spec.ts` under `test/` with supertest, run via the separate `vitest.config.e2e.ts`. |
| **Build output** | `tsconfig.build.json` narrows `rootDir` to `./src` and excludes `test`/`**/*spec.ts`, so `nest build` emits `dist/main.js` — which is what `start:prod` (`node dist/main`) expects. The base `tsconfig.json` has `rootDir: "."`; do not build with it directly or output paths shift to `dist/src/`. |
| **API standards** | *(not observable)* — only the scaffold `GET /` exists (`src/app.controller.ts:7`). No versioning prefix, no global pipes/filters/interceptors, no DTO layer, no error envelope. `src/main.ts` registers nothing beyond `listen()`. |
| **Persistence** | *(not observable)* — no ORM, no migrations, no DB config. |
| **Commits** | Conventional Commits, lowercase `feat:` subject, no body observed across all 3 commits (`git log`: `feat: add DevSpec workflow commands and reference documentation`, `feat: init commits`, `Initial commit`). Sample too small to call it enforced; no commitlint/husky present. |

## Frontend — `frontend/`
**Authoritative**: none (no package-level `CLAUDE.md` / `.claude/rules/`)

| Area | Standard |
|------|----------|
| **Router** | Next.js App Router (`app/` directory), not Pages. React Server Components by default — mark client components with `'use client'` explicitly. |
| **Naming** | App Router reserved filenames lowercase (`layout.tsx`, `page.tsx`, `globals.css`); components PascalCase. React 19 — no `import React` needed (`jsx: "react-jsx"`). |
| **Imports** | Path alias `@/*` → `./*` (repo-root-relative, **not** `src/*` — there is no `src/` dir): `frontend/tsconfig.json` `paths`. |
| **Styling** | Tailwind CSS 4 via PostCSS — `postcss.config.mjs` loads `@tailwindcss/postcss`; no `tailwind.config.*` file. Tailwind 4 is CSS-first: theme lives in `app/globals.css` under `@import "tailwindcss"` + `@theme inline`, with CSS custom properties (`--background`, `--foreground`) as the token layer. Add design tokens there, not in a JS config. |
| **Fonts** | `next/font/google` with CSS-variable output — `Geist` / `Geist_Mono` bound to `--font-geist-sans` / `--font-geist-mono` on `<html>` (`app/layout.tsx:5-13`). |
| **Types** | `strict: true`, `noEmit: true` (Next handles emit), `moduleResolution: "bundler"`, `target: "ES2017"`. Next's typed-routes helper is in use: `LayoutProps<"/">` at `app/layout.tsx:22`. |
| **Lint** | ESLint 9 flat config (`eslint.config.mjs`) composing `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`. No custom rules or overrides added. |
| **Format** | *(not observable)* — no prettier config, no format script on this side. Backend's `.prettierrc` does not apply here. |
| **Component library** | **None.** No `components/` dir, no design system, no UI dep beyond React. A change that adds UI builds minimal — there is no styled component to reuse yet. |
| **Tests** | *(not observable)* — no test runner, no test script, no spec files. |
| **State / data fetching** | *(not observable)* — no client-state lib, no query lib, no API client. |
