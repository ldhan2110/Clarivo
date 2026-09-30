# Context: Clarivo

> Greenfield: intended, not yet built. Refresh after first real code.
> Both packages are untouched framework scaffolds — no product code exists yet. Every "intended" line below is a target, not an observation.

**Does**: Clarivo is a requirements-discovery workspace for business analysts. A BA captures what comes out of stakeholder conversations and Clarivo turns it into traceable, versioned requirements — each requirement carrying the evidence it came from, so a later reader can see why it exists and what changed. Scope of this charter stops at the platform; live transcription and the real-time question-suggestion copilot are explicitly out until decided.

**Stack**:
- Backend — NestJS 12 on Node 26, **native ESM** (`backend/package.json:8` `"type": "module"`), TypeScript 6.0.3, vitest 4 + supertest, oxlint (with `oxlint-tsgolint` type-aware pass), prettier
- Frontend — Next.js 16.3.6 App Router, React 19.2.8, Tailwind CSS 4 (PostCSS plugin), TypeScript 5, ESLint 9 flat config
- Tooling — pnpm (backend lockfile-only; frontend pins `pnpm@12.4.1` at `frontend/package.json:22`)
- Persistence — **none yet**. No DB, no docker-compose, no `.env`, no migrations, no ORM models anywhere in the repo.

**Structure**:
```
backend/           NestJS API (independent package, own lockfile)
  src/
    app.module.ts        root module — imports: [] (empty)
    app.controller.ts    GET / → "Hello World!" (scaffold)
    main.ts              bootstrap, listens PORT ?? 3000
    modules/
      authentication/    0-byte placeholder files, no content
  test/                  e2e specs (*.e2e-spec.ts)
frontend/          Next.js app (independent package, own lockfile)
  app/                   App Router — layout.tsx, page.tsx, globals.css
  public/                stock scaffold SVGs
assets/            clarivo-logo.png
.claude/           DevSpec commands, skills, references
devspec/           this context pack + changes board
```

Not a pnpm workspace — `frontend/pnpm-workspace.yaml` exists but only carries an `allowBuilds` block (a create-next-app artifact), and `backend/` is not a member. The two packages install and build independently.

**Entry points**:
- Backend — `backend/src/main.ts:4` (`bootstrap()`, top-level `await` — ESM only)
- Frontend — `frontend/app/page.tsx`, wrapped by `frontend/app/layout.tsx:17`

**Build/test/run**:

| | Backend (`backend/`) | Frontend (`frontend/`) |
|---|---|---|
| build | `pnpm build` (`nest build`) | `pnpm build` (`next build`) |
| test | `pnpm test` (`vitest run`, `**/*.spec.ts`) | none configured |
| e2e | `pnpm test:e2e` (`vitest run --config ./vitest.config.e2e.ts`) | none configured |
| run (dev) | `pnpm start:dev` (`nest start --watch`) | `pnpm dev` (`next dev`) |
| run (prod) | `pnpm start:prod` (`node dist/main`) | `pnpm start` (`next start`) |
| lint | `pnpm lint` (`oxlint --type-aware src/ test/`) | `pnpm lint` (`eslint`) |
| format | `pnpm format` (prettier, src + test) | none configured |

**Graph**: code-review-graph — present at `.code-review-graph/` but **empty** (0 files, 0 nodes, 0 edges as of 2026-09-30). Nothing indexed because there is no product code. Downstream skills cannot resolve symbols from the graph yet; rebuild after the first real modules land.
