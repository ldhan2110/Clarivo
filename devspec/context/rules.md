# Rules

> Greenfield: intended, not yet built. Refresh after first real code.

## Don't touch
- `frontend/public/*.svg`, `frontend/app/favicon.ico` — stock create-next-app assets; replace deliberately, not incidentally
- `backend/pnpm-lock.yaml`, `frontend/pnpm-lock.yaml` — regenerate via pnpm, never hand-edit
- `.code-review-graph/` — generated index, rebuilt by tooling
- `devspec/changes/*/spec.html` — generated from the markdown artifacts; fix the markdown, never the HTML

## Before merge
- Backend: `pnpm lint` (`oxlint --type-aware src/ test/`) and `pnpm test` must pass. There is no typecheck script — `nest build` is what surfaces type errors, so build too.
- Frontend: `pnpm lint` must pass. No test suite exists to run.
- Both packages install and build independently; changing one does not require touching the other's lockfile.

## Backend non-negotiables (ESM)
These are hard runtime constraints, not style preferences — each one fails at runtime, not at compile time:
- **Every relative import ends in `.js`**, including imports of `.ts` files. `'./app.service.js'`, never `'./app.service'`.
- **No `__dirname` / `__filename` / `require()`.** Use `import.meta.dirname` / `import.meta.url`. This rules out directory-glob config (the kind ORMs and plugin loaders default to) — prefer explicit imports over path globs.
- **Keep `experimentalDecorators` + `emitDecoratorMetadata` on.** Nest DI and any decorator-metadata library depend on them. Switching to stage-3 decorators breaks the framework.
- **No floating promises** — `typescript/no-floating-promises` is `"error"` in `.oxlintrc.json`. Await it or explicitly `void` it.

## Security
- No auth boundary exists yet. `src/modules/authentication/` is empty — treat every endpoint as unauthenticated until an actual guard ships.
- No secrets handling exists yet: no `.env`, no `.env.example`, no config loader. `.env*` is already gitignored (`backend/.gitignore`, `frontend/.gitignore`) — keep it that way and commit only a values-free `.env.example`.
- Validate at the trust boundary. There is no global `ValidationPipe` registered in `src/main.ts` today, so nothing strips or rejects unexpected request fields. Any change adding an endpoint must not assume input is checked.

## Database
- **There is no database.** No connection config, no ORM, no migrations, no `schema.md` in this pack. A change that needs persistence is introducing it from zero — that includes choosing the driver, the migration tool, and the migration directory layout, and those belong in `design.md`.
- When a DB does land: schema changes ship as forward migration files committed to the repo, never as direct DDL run against a database. No `DROP` / `DELETE` / `TRUNCATE` in a spec — flag it for a human instead.

## Gotchas
- **`frontend/pnpm-workspace.yaml` is misleading.** It exists but only carries an `allowBuilds` block (a create-next-app artifact) and does not list `backend/`. This is *not* a pnpm workspace — run pnpm from inside each package. A root-level `pnpm install` will not wire the two together.
- **Two `tsconfig` targets on the backend.** `tsconfig.json` has `rootDir: "."`; `tsconfig.build.json` narrows it to `./src`. `nest build` uses the latter and emits `dist/main.js`. Build with the base config and output lands at `dist/src/main.js`, which `start:prod` (`node dist/main`) will not find.
- **Backend lints with oxlint, frontend with ESLint.** Different tools, different config formats. A rule added to one does not apply to the other.
- **`any` is allowed on the backend** (`typescript/no-explicit-any: "off"`) but flagged by `eslint-config-next/typescript` on the frontend. Same language, opposite defaults.
- **`strictPropertyInitialization: false`** on the backend means an unassigned property compiles silently. Convenient for decorator-driven classes; it also means a genuinely forgotten assignment produces a runtime `undefined` instead of a compile error.
- **The code graph is empty** (0 nodes). Any skill step that says "resolve the symbol via the code graph" cannot work yet — names must be read from the files directly until real code is indexed.
