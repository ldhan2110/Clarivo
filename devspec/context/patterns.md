# Patterns

> Greenfield: intended, not yet built. Refresh after first real code.
> **No recurring patterns exist.** A pattern is a solution repeated across a codebase; with two scaffolds and zero product code there is nothing repeated to record. The three entries below are the only structural shapes actually present, each a framework default rather than a project decision. Nothing here is fabricated as a project convention — the first real module is what establishes these.

## dependency injection (backend)
Constructor injection with `private readonly`, provider registered in the module's `providers` array — the Nest default, not a choice this project made yet.
— `src/app.controller.ts:6` (`constructor(private readonly appService: AppService) {}`), registered at `src/app.module.ts:9`

## route declaration (backend)
`@Controller()` class + HTTP-verb method decorator, controller listed in the module's `controllers` array. Return value is serialized by Nest; no DTO, no response envelope, no status-code override in play.
— `src/app.controller.ts:4-10`, registered at `src/app.module.ts:8`

## root layout composition (frontend)
Single App Router root layout applies font CSS variables to `<html>` and Tailwind utilities to `<body>`; pages render as `children`. No provider tree, no context, no client boundary anywhere yet.
— `frontend/app/layout.tsx:22-34`

## not yet established
These have no implementation to mirror. A change that needs one is establishing it, not following it — decide it in `design.md` rather than assuming a house style exists:

- error handling — no exception filter, no error envelope, no typed error class
- validation — no pipe, no DTO layer, no schema
- configuration — no `ConfigModule`, no env loading, no env validation
- data access — no ORM, no repository, no migration, no transaction helper
- authentication / authorization — `src/modules/authentication/` holds two 0-byte files and nothing else
- logging / observability — Nest's default logger only, unconfigured
- frontend data fetching, client state, forms, and component composition — none present
