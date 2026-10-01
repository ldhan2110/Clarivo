# Design: add-projects

Companion documents: `proposal.md` (why / scope), `db.md` (live schema + migration verdict),
`ui.md` (screens, states, components to reuse, approved mockups).

This file holds the decisions that are neither pure schema nor pure layout: the access model,
the API shapes this change establishes, how the sidebar gains a second scope, and the Decision
Defaults a worker applies instead of stopping.

---

## Architecture

```
BROWSER                                        API (NestJS)

/projects              ProjectsListPage        GET    /projects                  ┐
  └ use-projects.ts ──► services/projects.ts   POST   /projects                  │
/projects/:id          ProjectOverviewPage     GET    /projects/:id              │
  └ use-project.ts  ──►        │               PATCH  /projects/:id              ├─► ProjectsController
/projects/:id/settings ProjectSettingsPage     POST   /projects/:id/archive      │     @UseGuards(JwtAuthGuard)
  └ use-project-members.ts ────┘               POST   /projects/:id/restore      │
                                               GET    /projects/:id/members      │
          all through lib/api.ts (axios,       POST   /projects/:id/members      │
          withCredentials: true)               DELETE /projects/:id/members/:userId ┘
                                                              │
                                                              ▼
                                                      ProjectsService
                                        ┌─────────────────────┼──────────────────────┐
                                        ▼                     ▼                      ▼
                              Repository<Project>   Repository<ProjectMember>   UsersService
                                 (projects)           (project_members)        (findByEmail)

SIDEBAR (one source, two scopes)
  constants/nav.ts ── GLOBAL_NAV_ITEMS ───┐
                   └─ projectNavItems() ──┴─► hooks/use-nav-scope.ts ─┬─► components/sidebar/nav-groups.tsx  (desktop)
                                                                      └─► components/sidebar/mobile-nav.tsx  (drawer)
```

Every request enters through `JwtAuthGuard`, so `req.user` is a `User` before any handler body
runs — the same shape `FilesController` already relies on. `ProjectsService` is the only place
that touches either repository, and the membership gate below is applied inside it, not in the
controller, so no future caller can route around it.

---

## Access model

**One gate, applied in the service, for every operation.** Resolve the viewer's
`project_members` row for the project id first; branch on what came back.

| Viewer | Read (list / get / members) | Owner-only write (update, archive, restore, member add/remove) |
|---|---|---|
| owner | allowed | allowed |
| member | allowed | **403 `PROJECT_NOT_OWNER`** |
| non-member, or unknown id | **404 `PROJECT_NOT_FOUND`** | **404 `PROJECT_NOT_FOUND`** |

**Why a non-member gets 404 and a member gets 403.** A 403 for a non-member confirms the project
exists, which is exactly the leak membership scoping is there to prevent. A member already knows
the project exists — they can read it — so 403 tells them something true and actionable ("you are
not the owner") without revealing anything new. Collapsing both into 404 would make the settings
page indistinguishable from a bug for a member who typed the URL.

**The list query is membership-first.** `GET /projects` never filters a global project set down to
the viewer's; it starts from `project_members WHERE user_id = :viewer` and joins outward. A
project the viewer is not on cannot appear in the result set even if the status or search filter
is wrong, because it was never in the candidate rows. That ordering is the security property —
keep the join direction if the query is ever rewritten.

**Creation makes the creator the owner, atomically.** `POST /projects` writes the `projects` row
and the `project_members` row with `role='owner'` inside **one transaction**. A project with no
owner row would be invisible to its own creator and unreachable by every endpoint — unrecoverable
through the API, since every write is owner-gated. `dataSource.transaction()` around both saves.

---

## API shapes this change establishes

Three shapes have no precedent in the repo. They become the pattern every later domain copies.

### Paginated list envelope

```ts
class ProjectListDto {            // dto/project-list.dto.ts
  @Expose() items: ProjectSummaryDto[];
  @Expose() total: number;        // matching rows before paging
  @Expose() page: number;
  @Expose() limit: number;
}
```

A concrete DTO per domain, not a generic `Paginated<T>`. TypeORM is not the constraint here —
`@nestjs/swagger` and `class-transformer` both need a real class to read metadata off, and a
generic wrapper needs `ApiExtraModels` + `getSchemaPath` plumbing per endpoint to produce a
usable OpenAPI schema. Three extra lines per domain beats that.
<!-- ponytail: one concrete list DTO per domain. Revisit when the fourth one exists, not the second. -->

### Query DTO composes the shared pieces

`ListProjectsDto` nests `PaginationDto` and `SortDto` as `pagination` / `sort` rather than
flattening them — the convention `pagination.dto.ts:4` documents. `sortBy` is re-declared with
`@IsIn(['updatedAt', 'createdAt', 'name', 'code'])` so an arbitrary string can never reach the
`ORDER BY`; default `updatedAt DESC`. Own fields: `q` (optional search) and
`status` (`active` | `archived` | `all`, default `active`).

### Two response DTOs, not one

`ProjectSummaryDto` (list rows, dashboard) and `ProjectDto` (detail) are separate classes. The
list needs `memberCount` + up to three member names for the avatar stack; the detail needs
`objective`, both dates and `createdByName`. One DTO carrying every field would make the list
query join and serialise prose it never renders.

| | `ProjectSummaryDto` | `ProjectDto` |
|---|---|---|
| id, createdAt, updatedAt | ✓ (`AuditDto`) | ✓ (`AuditDto`) |
| code, name, customerBu, domain, status | ✓ | ✓ |
| memberCount | ✓ | ✓ |
| memberNames (max 3, for the avatar stack) | ✓ | — |
| viewerRole (`owner` \| `member`) | ✓ | ✓ |
| objective, startsOn, endsOn | — | ✓ |
| createdByName | — | ✓ |

`created_by` (the uuid) carries **no `@Expose()`** on either DTO — the same mechanism that keeps
`files.uploadedBy` server-side. The detail view needs the creator's *name*, so `createdByName`
ships the display string and the id stays internal.

**`starts_on` / `ends_on` serialise as `'YYYY-MM-DD'` strings, not `Date`.** TypeORM returns a
`date` column as a string, and that is what we want: wrapping it in a `Date` would re-introduce a
timezone and could render a start date a day early for a viewer behind UTC. Typed `string` on the
DTO. First `date` columns in the repo — record it in `schema.md`.

---

## The four Overview counts are frontend constants, not API fields

Overview shows Context documents / Meetings held / Requirements collected / Open questions, all
`0` with a `Soon` badge. **No API field backs them.** An API returning `requirementsCount: 0`
from a table that does not exist is a field that lies by construction, and the first change to
add requirements would have to decide whether the old zero was real. `memberCount` *is* a real
API field because `project_members` exists.

The stage counts live in a frontend constant alongside their `Soon` flags, so
`add-project-context` / `add-meetings` / `add-requirements` each replace one constant with one
query and the page layout never changes.

---

## Sidebar: two scopes, still one source

`constants/nav.ts` currently exports a single `NAV_ITEMS` array that **both**
`nav-groups.tsx` (desktop) and `mobile-nav.tsx` (drawer) render, so the two cannot drift. That
property is the thing to preserve; this change widens the source instead of forking it.

```ts
// constants/nav.ts
export const GLOBAL_NAV_ITEMS: NavItemDef[]                     // Dashboard, Projects, Settings
export function projectNavItems(id: string, isOwner: boolean): NavItemDef[]
export const GLOBAL_NAV_GROUPS: NavGroup[]                      // Workspace, Account
export const PROJECT_NAV_GROUPS: NavGroup[]                     // Plan, Run, Output, Project
```

```ts
// hooks/use-nav-scope.ts  — the one scope decision
// Returns { scope: 'global' | 'project', groups, items, project? } from the pathname.
```

`NavGroups` takes its items and groups from `useNavScope()`; `mobile-nav.tsx` keeps passing
through to the same `NavGroups`, so **neither renderer gains a second source**. A project-scope
render also gets a back row (`← All projects`) and the static project label above the groups.

- `types/nav.ts`: `NavGroup` becomes
  `"Workspace" | "Account" | "Plan" | "Run" | "Output" | "Project"`. `"Insights"` is **removed**
  with the four global rows that used it (Requirements, Questions, Decisions, Documents) — those
  nouns are project-scoped from now on. A leftover `"Insights"` member with no items would render
  an empty group header.
- The project label is a **static label, not a dropdown** (`ui.md`). It reads code + name out of
  the `useProject(id)` cache, so entering a project costs no extra request; before that cache is
  warm it renders the skeleton state `ui.md` specifies.
- The `Settings` row and the `⚙ Settings` button appear only when `viewerRole === 'owner'`.

---

## Verification needs a second account

`ui.md` and `proposal.md` both flag it: `devspec/improve/testing.md` records only
`admin@clarivo.local`, and member-vs-owner and non-member are three of this change's states.
Clarivo has no signup endpoint, so the **only** way to create an account is the seed path.

**Decision: `pnpm seed` gains an optional second account.** `SEED_MEMBER_EMAIL` /
`SEED_MEMBER_PASSWORD` / `SEED_MEMBER_NAME` are added to `EnvironmentVariables` as
**`@IsOptional()`** (the first optional vars in the contract) and seeded only when all three are
set. Optional, because a required var would invalidate every existing `.env` — the cost
`FILE_STORAGE_PATH` already imposed once, and not worth repeating for a test fixture.
Credentials go in the gitignored `devspec/improve/testing.md`, never in `.env.example` (which
gets the empty rows and a comment) and never in a commit.

Rejected: inserting the row with SQL (the worker is forbidden from touching the live DB directly,
and an unseeded account would not survive a DB reset); hardcoding a fixture account in
`seed.ts` (a committed password, even a dev one, is the wrong precedent).

---

## Rejected approaches

| Considered | Rejected because |
|---|---|
| `deleted_at` soft-delete column for archive | The repo has no soft delete anywhere and no `@DeleteDateColumn`. Archive is domain state the UI renders as an `Active`/`Archived` badge, not a deletion. `db.md` records this. |
| Postgres `enum` type for `status` / `role` | Adding a value needs `ALTER TYPE … ADD VALUE`, which cannot run inside a transaction block — a migration footgun for a two-value set. `varchar` + `@Check()` widens with a plain constraint swap. First enum in the repo, so this sets the precedent. |
| A `GET /dashboard` endpoint for the dashboard tiles | Total + 5 recent actives is `GET /projects?pagination[limit]=5&status=active` plus the envelope's `total`. A second endpoint returning a subset of an existing one is pure duplication. |
| Generic `PaginatedDto<T>` | Swagger generics need per-endpoint `ApiExtraModels`/`getSchemaPath` plumbing to emit a usable schema; the generated frontend types would degrade to `unknown`. |
| 403 for a non-member | Confirms the project exists. The whole point of membership scoping is that it does not. |
| Project switcher as a dropdown | A second list query for navigation `← All projects` already provides. |
| Edit-details modal on the list row menu | Two places editing the same six fields, two validation paths. Settings owns editing. |
| `CHECK` on `projects.domain` | Customer data that grows; every new vertical would become a migration. |
| `CHECK (ends_on >= starts_on)` | Validated in the DTO where the message can name the field. A constraint violation surfaces as a 500-shaped driver error with no field to attach to. |

---

## Impact Area

### Decision Defaults

Pre-decided so the worker proceeds instead of stalling. Each is a human decision already made.

| # | Gray area | Default |
|---|---|---|
| 1 | Backend file layout for the new domain | `backend/src/projects/` mirroring `src/files/` exactly: `project.entity.ts`, `project-member.entity.ts`, `projects.service.ts`, `projects.controller.ts`, `projects.errors.ts`, `projects.module.ts`, `dto/`, and `*.spec.ts` **next to the source** |
| 2 | Entity class names | `Project` and `ProjectMember`. Neither shadows a Node global, so the `FileEntity` workaround does not apply |
| 3 | Entity registration | `TypeOrmModule.forFeature([Project, ProjectMember])` inside `ProjectsModule` **only** — `app.module.ts` passes `entities: []` + `autoLoadEntities: true`, so registering anywhere else is a silent no-op |
| 4 | Error codes | `defineErrors('PROJECT', …)`: `NOT_FOUND` (404), `NOT_OWNER` (403), `CODE_TAKEN` (409), `INVALID_DATE_RANGE` (400), `MEMBER_NOT_FOUND` (404 — no account with that email), `ALREADY_MEMBER` (409), `OWNER_NOT_REMOVABLE` (409) |
| 5 | Duplicate `code` detection | Pre-check with a `findOne({ where: { code } })` and throw `CODE_TAKEN`; also catch the unique-violation (`23505`) from the insert and map it to the same error. The pre-check gives the message, the catch closes the race |
| 6 | Archive / restore verb | `POST /projects/:id/archive` and `/restore`. Not a `PATCH { status }` — the status transition is the operation, and a general status write invites a client inventing a third value |
| 7 | Archiving an already-archived project (and restore of an active one) | **Idempotent 200**, returning the project unchanged. Not an error: the UI can double-submit and the end state is what was asked for |
| 8 | Can an archived project still be updated? | **No.** `PATCH` and member add/remove on an archived project return `PROJECT_ARCHIVED` (409). `ui.md` renders those controls disabled; the API must agree rather than trust the UI |
| 9 | Search `q` semantics | Case-insensitive `ILIKE '%q%'` against `code` **or** `name`. No full-text index, no trigram — `ponytail:` comment naming the ceiling |
| 10 | Sort whitelist + default | `@IsIn(['updatedAt','createdAt','name','code'])`, default `updatedAt DESC` |
| 11 | Avatar stack data | `ProjectSummaryDto.memberNames: string[]`, at most 3, ordered by `project_members.created_at` (owner first, since the owner row is written first). The frontend derives initials; `memberCount - memberNames.length` is the `+N` overflow |
| 12 | Where `viewerRole` comes from | The membership row the gate already loaded. No second query |
| 13 | Member add matching | `UsersService.findByEmail` (already normalises case). No match → `MEMBER_NOT_FOUND`; existing membership → `ALREADY_MEMBER`. **No invite is created and no email is sent** |
| 14 | Removing the owner | `OWNER_NOT_REMOVABLE` (409). The UI renders no `✕` on that row; the API enforces it independently |
| 15 | Removing yourself as a member | Not reachable — remove is owner-only, and an owner cannot remove the owner row. No self-leave endpoint in this change |
| 16 | Frontend service / hook placement | `services/projects.ts` (one function per endpoint, returns unwrapped `data`), `hooks/use-projects.ts` (list), `hooks/use-project.ts` (detail + mutations), `hooks/use-project-members.ts`. Layer law from `frontend/CLAUDE.md`: component → hooks → services → `lib/api` |
| 17 | Query keys | `['projects', params]` for the list, `['project', id]` for the detail, `['project', id, 'members']` for members. Mutations invalidate the narrowest key that changed, plus `['projects']` when a row's list appearance changed |
| 18 | Form library | `react-hook-form` + `zodResolver`, schema beside the form, `z.infer` for the type, server errors via `setError`. Mandated by `frontend/CLAUDE.md`; **never `watch()`** (React Compiler + `react-hooks/incompatible-library`) |
| 19 | Where a field error vs a toast goes | Duplicate code → field error under the code input. Bad date range → field error on the end date. Unknown email / already a member → field error under the email input. Anything else → the global `MutationCache` toast, which means **do not define a local `onError`** on those mutations unless the intent is to stand the toast down |
| 20 | Detail page 400 vs 404 | A malformed uuid is a 400 from `ParseUUIDPipe`, a missing-or-not-mine project is a 404. The detail page renders the **same** "Project not found" screen for both — to a user they are one situation |
| 21 | Sidebar scope while the detail query is in flight | Project scope with a skeleton label (`ui.md` loading state), chosen from the **pathname**, not from loaded data. Rendering global scope first would flash the wrong nav |
| 22 | A member hitting `/projects/:id/settings` directly | Render the shared "Project not found" screen (`ui.md`). The API still answers `GET /projects/:id` for them — this is a route-level presentation choice, and the owner-only writes are enforced server-side regardless |
| 23 | New confirm presets | `confirmArchive` / `confirmRestore` / `confirmRemoveMember` added **beside** `confirmDelete` in `constants/confirm.ts`, with the copy in `ui.md`. `confirmDelete` is not reused — its "permanently deleted. This can't be undone." is false for all three |
| 24 | The three hand-copied primitives | `components/ui/dialog.tsx`, `table.tsx`, `textarea.tsx`, copied from shadcn/ui **new-york** to match `components.json`. The CLI hangs in this environment (`rules.md`); install any missing radix dep with pnpm |
| 25 | Where the Overview stage counts live | `constants/project-stages.ts` — label, href, `Soon` flag and the literal `0`. One constant per stage so a later change swaps one line for one query |
| 26 | Dashboard data source | The existing list endpoint (Default 6 above). `constants/dashboard.ts` loses `RECENT_PROJECTS`, `NEXT_MEETING` and the projects `Stat`; the other three tiles keep their constants and gain a `Soon` marker |
| 27 | Generated API types | `pnpm api:types` in `frontend/` with the backend running, **after** the controller is final. `frontend/app/types/api/**` is generated — never hand-edited (`rules.md`) |
| 28 | `schema.md` refresh | Part of this change, not a follow-up. It records enums (varchar + CHECK), the first composite unique, the first `date` columns, and the `ON DELETE CASCADE` exception **with its reasoning**, so the next change does not read one CASCADE as blanket permission |

### Blast Radius

Resolved against the live tree.

**New — nothing reads these yet**
`backend/src/projects/**` · `backend/src/database/migrations/<ts>-CreateProjects.ts` ·
`frontend/services/projects.ts` · `frontend/hooks/use-projects.ts` · `use-project.ts` ·
`use-project-members.ts` · `use-nav-scope.ts` · `frontend/types/project.ts` ·
`frontend/constants/project-stages.ts` · `frontend/components/ui/{dialog,table,textarea}.tsx` ·
`frontend/components/projects/**` · `frontend/app/(app)/projects/**`

**Shared surfaces — where a reviewer should look hardest**

| File | Change | Risk |
|---|---|---|
| `frontend/constants/nav.ts` | single array → two scopes + a function | **high.** It feeds desktop and mobile; the single-source property must survive |
| `frontend/types/nav.ts` | `NavGroup` union: `"Insights"` out, four project groups in | medium. A stale `"Insights"` renders an empty group header |
| `frontend/components/sidebar/nav-groups.tsx` | items/groups from `useNavScope()` instead of the constant import | medium. The one renderer both shells use |
| `frontend/constants/confirm.ts` | three presets added | low. Additive; `confirmDelete` untouched |
| `frontend/app/(app)/page.tsx` | delete `FeedbackDemoCard`, delete the Next Meeting card, wire two real tiles | medium. Deleting the demo card is intended (`add-feedback-layer` left a `ponytail:` note asking for exactly this) |
| `frontend/constants/dashboard.ts` | `RECENT_PROJECTS`, `NEXT_MEETING`, projects `Stat` removed | low, but `types/dashboard.ts` must drop the orphaned types in the same commit |
| `backend/src/app.module.ts` | one import line: `ProjectsModule` | low. Same shape `FilesModule` added |
| `backend/src/config/env.validation.ts` | three **optional** `SEED_MEMBER_*` vars | low — optional, so no existing `.env` breaks |
| `backend/src/database/seeds/seed.ts` | seeds the second account when those vars are set | low. Guarded; admin path unchanged |
| `backend/.env.example` | `SEED_MEMBER_*` rows, empty + commented | low |
| `devspec/context/schema.md` | refreshed with both tables and four settled conventions | documentation |

**Untouched on purpose**: `backend/src/users/**` (two new FKs point at `users.id`; `User` gains
no inverse relation — no existing entity declares one), `backend/src/files/**` (the first
`file_id` FK lands in `add-project-context`), `backend/src/auth/**`,
`backend/test/app.e2e-spec.ts` (the pre-existing failure logged in
`devspec/report/blockers.md` — out of scope, do not touch).

**No existing query reads either new table, so nothing can regress on the backend.** The real
regression surface is the sidebar: every authenticated route renders it.

### Risk / reversibility

| | |
|---|---|
| **Migration** | Purely additive — two new tables, three FKs, two unique constraints, one index, two CHECKs. No column on an existing table is added, altered or dropped. No backfill. **Reverts clean** by dropping the two tables in FK order. No destructive operation anywhere in this change |
| **Data loss risk** | **None.** There is no hard delete in the service and none in the UI. Archive is a status value; removing a member deletes one `project_members` row, which holds no content |
| **Reversibility** | High. Backend code is new files plus one import line. The frontend nav rewrite is the only edit that is awkward to revert piecemeal — it should land as its own commit |
| **Biggest defect risk** | The three hand-copied primitives (`dialog`, `table`, `textarea`). Transcription error, not design error. `tsc` + `eslint` + actually rendering each one is the check |
| **Second biggest** | The nav scope split silently drifting desktop and mobile apart. The mitigation is structural: both keep rendering one `NavGroups` fed by one hook |
| **Security posture** | `whitelist` + `forbidNonWhitelisted` stay on, so an undeclared field is a 400. `created_by` has no `@Expose()` on any DTO. Membership is enforced in the service, not the controller. No new secret, no weakened check, no widened scope — the `SEED_MEMBER_*` vars are optional dev fixtures validated like every other var and committed only as empty rows |

---

## Open questions

**None blocking.** One note for whoever reads this later: `ProjectSummaryDto.memberNames` caps at
three because the mockup's avatar stack shows three. If a later screen wants a different stack
size, that is a DTO change, not a query change — the service already loads the membership rows it
counts.
