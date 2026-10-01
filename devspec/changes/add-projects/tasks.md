# Tasks: add-projects

Walk top to bottom — each section relies on the ones above it. Names are resolved against the
real tree; `design.md` Impact Area holds the Decision Defaults for anything a subtask leaves
open. Reuse targets in the frontend sections are from `ui.md` and are not suggestions.

---

## 1. Entities and migration [req-1]
- [x] 1.1 [db] New `backend/src/projects/project.entity.ts` — `@Entity('projects')` class `Project extends BaseEntity`; columns `code` varchar(64) unique, `name`/`customer_bu`/`domain` varchar(255), `objective` text nullable, `status` varchar(16) default `'active'`, `starts_on`/`ends_on` type `date` nullable (typed `string`), `created_by` uuid + `@ManyToOne(() => User, { onDelete: 'RESTRICT' })` + `@JoinColumn({ name: 'created_by' })`. Every column declares an explicit snake_case `name:` — mirror `src/files/file.entity.ts`
- [x] 1.2 [db] Add `@Check("status IN ('active','archived')")` to `Project`. No CHECK on `domain` — `db.md` records why
- [x] 1.3 [db] New `backend/src/projects/project-member.entity.ts` — `@Entity('project_members')` class `ProjectMember extends BaseEntity`; `project_id` uuid + `@ManyToOne(() => Project, { onDelete: 'CASCADE' })`, `user_id` uuid + `@ManyToOne(() => User, { onDelete: 'RESTRICT' })`, `role` varchar(16) with `@Check("role IN ('owner','member')")`, plus `@Unique(['projectId','userId'])` and `@Index(['userId'])`
- [x] 1.4 [backend] New `backend/src/projects/projects.module.ts` registering `TypeOrmModule.forFeature([Project, ProjectMember])` — the only thing that registers either entity (`app.module.ts` passes `entities: []` + `autoLoadEntities: true`)
- [x] 1.5 [backend] Register `ProjectsModule` in `backend/src/app.module.ts` — one import line, same shape as `FilesModule`
- [x] 1.6 [test] New `backend/src/projects/project.entity.spec.ts` and `project-member.entity.spec.ts` reading `getMetadataArgsStorage()` (the `src/files/file.entity.spec.ts` pattern — `DataSource.getMetadata()` throws before connection): assert the table names, every column's snake_case `name:`, both CHECK expressions, the composite unique, the `user_id` index and each relation's `onDelete`
- [x] 1.7 [db] `cd backend && pnpm build` clean first, then `pnpm migration:generate src/database/migrations/CreateProjects` — read the emitted SQL before running it. Additive only: two CREATE TABLEs, three FKs, two uniques, one index, two CHECKs. **No DROP, ALTER or DELETE against an existing table may appear**
- [x] 1.8 [db] `pnpm migration:run`, then `pnpm migration:revert`, then `pnpm migration:run` again — prove the round trip before any service code depends on the tables
Verify: `cd backend && pnpm build && pnpm vitest run src/projects && pnpm migration:show`

## 2. Error codes and DTOs [req-2] [req-3] [req-4] [req-5] [req-6] [req-7]
- [x] 2.1 [backend] New `backend/src/projects/projects.errors.ts` — `defineErrors('PROJECT', {...})` with `NOT_FOUND` 404, `NOT_OWNER` 403, `CODE_TAKEN` 409, `INVALID_DATE_RANGE` 400, `ARCHIVED` 409, `MEMBER_NOT_FOUND` 404, `ALREADY_MEMBER` 409, `OWNER_NOT_REMOVABLE` 409. Never `throw new HttpException` in domain code
- [x] 2.2 [backend] New `dto/create-project.dto.ts` — `code` `@IsString() @IsNotEmpty() @MaxLength(64)`, `name`/`customerBu`/`domain` required strings, `objective` `@IsOptional() @IsString()`, `startsOn`/`endsOn` `@IsOptional() @IsDateString()`. JSDoc each field — the Swagger CLI plugin turns comments into descriptions
- [x] 2.3 [backend] New `dto/update-project.dto.ts` — `PartialType(CreateProjectDto)`
- [x] 2.4 [backend] New `dto/list-projects.dto.ts` — nests `PaginationDto` as `pagination` and a `SortDto` subclass as `sort` with `sortBy` re-declared `@IsIn(['updatedAt','createdAt','name','code'])`; own fields `q?` string and `status` `@IsIn(['active','archived','all'])` defaulting to `'active'`. Nested, never flat (`src/common/dtos/pagination.dto.ts:4`)
- [x] 2.5 [backend] New `dto/project.dto.ts` (detail) and `dto/project-summary.dto.ts` (list rows), both extending `AuditDto`, fields `@Expose()`d per the table in `design.md`. **`createdBy` gets no `@Expose()`** — the uuid stays server-side; `createdByName` carries the display string
- [x] 2.6 [backend] New `dto/project-list.dto.ts` — `items: ProjectSummaryDto[]`, `total`, `page`, `limit`, all `@Expose()`d. A concrete class per domain, not a generic wrapper; add a `ponytail:` comment naming that ceiling
- [x] 2.7 [backend] New `dto/project-member.dto.ts` (`userId`, `name`, `email`, `role`) and `dto/add-member.dto.ts` (`email` `@IsEmail()`)
- [x] 2.8 [test] New `backend/src/projects/projects.errors.spec.ts` asserting each code is `PROJECT_<KEY>` with the right status, and a DTO spec proving `createdBy` does not survive `plainToInstance(..., { excludeExtraneousValues: true })`
Verify: `cd backend && pnpm vitest run src/projects`

## 3. ProjectsService — the membership gate and every operation [req-2] [req-3] [req-4] [req-5] [req-6] [req-7]
- [x] 3.1 [service] New `backend/src/projects/projects.service.ts` with `Repository<Project>` + `Repository<ProjectMember>` + `UsersService` injected, and one private `requireMembership(projectId, viewerId, { owner?: boolean })` resolving the viewer's membership row: no row → `PROJECT_NOT_FOUND`; `owner: true` and `role !== 'owner'` → `PROJECT_NOT_OWNER`. **Every public method goes through it** — the gate lives here, not in the controller
- [x] 3.2 [service] `create(dto, viewerId)` — inside `dataSource.transaction()`: insert the project with `created_by = viewerId`, then the `project_members` owner row. Pre-check `code` and throw `CODE_TAKEN`; also map Postgres `23505` from the insert to the same error. Validate `endsOn >= startsOn` → `INVALID_DATE_RANGE`
- [x] 3.3 [service] `list(dto, viewerId)` — query **from `project_members` where `user_id = viewerId`** and join outward to `projects`; apply `status`, `ILIKE '%q%'` on `code` or `name`, the whitelisted `ORDER BY`, then `skip`/`take` from `dto.pagination`. Return `{ items, total, page, limit }`. A `ponytail:` comment names the ILIKE ceiling. **Keep the join direction** — it is the security property
- [x] 3.4 [service] Fill `memberCount`, up to three `memberNames` (ordered by `project_members.created_at`, so the owner comes first) and `viewerRole` from the membership rows already loaded — no second round trip per row
- [x] 3.5 [service] `findOne(id, viewerId)` — gate, then return the project with `createdByName` from a join on `users`
- [x] 3.6 [service] `update(id, dto, viewerId)` — owner gate; `PROJECT_ARCHIVED` if the project is archived; `CODE_TAKEN` if another project holds the new code; patch only the supplied fields
- [x] 3.7 [service] `archive(id, viewerId)` / `restore(id, viewerId)` — owner gate, set `status`, **idempotent** (already in the target state → return unchanged, no error). **No delete method on this service at all**
- [x] 3.8 [service] `listMembers`, `addMember`, `removeMember` — member gate for the read, owner gate for both writes; `PROJECT_ARCHIVED` on either write against an archived project; `UsersService.findByEmail` (already case-normalising) → `MEMBER_NOT_FOUND` when absent, `ALREADY_MEMBER` on a duplicate, `OWNER_NOT_REMOVABLE` when the target row is the owner
- [x] 3.9 [test] New `backend/src/projects/projects.service.spec.ts` — one case per spec scenario in [req-2]–[req-7], with the owner / member / non-member matrix explicit: non-member reads **404**, member writes **403**
Verify: `cd backend && pnpm vitest run src/projects`

## 4. ProjectsController [req-2] [req-3] [req-4] [req-5] [req-6] [req-7]
- [x] 4.1 [backend] New `backend/src/projects/projects.controller.ts` — `@Controller('projects')`, every route `@UseGuards(JwtAuthGuard)` + `@ApiCookieAuth(SESSION_COOKIE)`, viewer read as `req.user as User` (the `FilesController` shape)
- [x] 4.2 [backend] `POST /projects` → 201 `ProjectDto`; `GET /projects` with `@Query() ListProjectsDto` → `ProjectListDto`
- [x] 4.3 [backend] `GET /projects/:id` and `PATCH /projects/:id`, both `@Param('id', ParseUUIDPipe)`
- [x] 4.4 [backend] `POST /projects/:id/archive` and `POST /projects/:id/restore` → `ProjectDto`. **No DELETE route on a project anywhere**
- [x] 4.5 [backend] `GET /projects/:id/members`, `POST /projects/:id/members` → 201, `DELETE /projects/:id/members/:userId` → 204 `@HttpCode(204)`
- [x] 4.6 [backend] Serialise every response through `plainToInstance(Dto, entity, { excludeExtraneousValues: true })` — the `toFileDto` helper shape in `files.controller.ts`
- [x] 4.7 [backend] Register the controller in `ProjectsModule` and export `ProjectsService`
- [x] 4.8 [test] New `backend/src/projects/projects.controller.spec.ts` — route wiring, the 204 on remove, and that no project-delete route exists
Verify: `cd backend && pnpm lint && pnpm vitest run src/projects && pnpm build`

## 5. Second test account for the member-vs-owner states [req-14]
- [x] 5.1 [backend] Add `SEED_MEMBER_EMAIL`, `SEED_MEMBER_PASSWORD`, `SEED_MEMBER_NAME` to `EnvironmentVariables` in `backend/src/config/env.validation.ts` as **`@IsOptional()`** strings — required vars would invalidate every existing `.env`
- [x] 5.2 [backend] In `backend/src/database/seeds/seed.ts`, after the admin upsert, upsert the member account **only when all three are set**; reuse the existing argon2id + `normaliseEmail` path. The admin branch is untouched
- [x] 5.3 [backend] Add the three rows to `backend/.env.example`, empty, with a comment saying they are an optional local test fixture
- [x] 5.4 [test] Extend `backend/src/database/seeds/seed.spec.ts` — all three set → second account upserted idempotently; any unset → skipped and the seed still succeeds
- [x] 5.5 [backend] Set the three in the gitignored `backend/.env`, run `cd backend && pnpm seed`, and record the credentials in the gitignored `devspec/improve/testing.md` under a new `## Second account (project member)` heading. **Never commit the password**
Verify: `cd backend && pnpm vitest run src/database/seeds && pnpm seed`

## 6. Frontend data layer [req-14] [req-8] [req-10] [req-12]
- [x] 6.1 [frontend] With the backend running, `cd frontend && pnpm api:types` — regenerates `frontend/app/types/api/types.gen.ts`. Generated: never hand-edit (`devspec/context/rules.md`)
- [x] 6.2 [frontend] New `frontend/services/projects.ts` — one function per endpoint (`listProjects`, `getProject`, `createProject`, `updateProject`, `archiveProject`, `restoreProject`, `listMembers`, `addMember`, `removeMember`), each returning unwrapped `data` from the shared `@/lib/api` axios instance, typed from `@/types/api`. No React, no toasts, no routing (`frontend/CLAUDE.md` layer law)
- [x] 6.3 [frontend] New `frontend/hooks/use-projects.ts` — `useProjects(params)` on key `['projects', params]`
- [x] 6.4 [frontend] New `frontend/hooks/use-project.ts` — `useProject(id)` on `['project', id]`, plus `useCreateProject`, `useUpdateProject`, `useArchiveProject`, `useRestoreProject`, each invalidating the narrowest changed key plus `['projects']`
- [x] 6.5 [frontend] New `frontend/hooks/use-project-members.ts` — `useProjectMembers(id)` on `['project', id, 'members']`, plus `useAddMember` / `useRemoveMember` invalidating that key and `['project', id]`
- [x] 6.6 [frontend] Leave `onError` **undefined** on every mutation whose failure should surface as the global toast; define it only where a field error replaces the toast (create/update code clash, date range, member email) — the `MutationCache` override rule in `components/provider/query-provider.tsx`
- [x] 6.7 [frontend] New `frontend/types/project.ts` for view-model-only shapes the generated types do not cover (e.g. the list filter state). Anything already in `@/types/api` is **not** re-declared
Verify: `cd frontend && npx tsc --noEmit && pnpm lint`

## 7. The three missing UI primitives [req-8] [req-9] [req-12]
- [x] 7.1 [frontend] Hand-copy `components/ui/dialog.tsx` from shadcn/ui **new-york** (`components.json` sets the style). Import shape must match the installed umbrella package: `import { Dialog as DialogPrimitive } from "radix-ui"` — the `sheet.tsx` / `alert-dialog.tsx` pattern, **no new dependency needed**. `alert-dialog.tsx` is not a substitute: no close button, outside-click blocked, owned by the confirm provider
- [x] 7.2 [frontend] Hand-copy `components/ui/table.tsx` (plain elements, no radix dep)
- [x] 7.3 [frontend] Hand-copy `components/ui/textarea.tsx` (plain element, no radix dep)
- [x] 7.4 [frontend] Render each one once in the running app before building on it — transcription error is this change's most likely defect, and `tsc` alone will not catch a dropped class string
Verify: `cd frontend && npx tsc --noEmit && pnpm lint && pnpm build`

## 8. Sidebar: two scopes, one source [req-11]
- [x] 8.1 [frontend] `frontend/types/nav.ts` — widen `NavGroup` to `"Workspace" | "Account" | "Plan" | "Run" | "Output" | "Project"`; **remove `"Insights"`** (a group with no items renders an empty header)
- [x] 8.2 [frontend] `frontend/constants/nav.ts` — replace `NAV_ITEMS` with `GLOBAL_NAV_ITEMS` (Dashboard enabled, **Projects enabled → `/projects`, `Soon` badge gone**, Settings still disabled; the Meetings / Requirements / Questions / Decisions / Documents rows **deleted**) plus `projectNavItems(id, isOwner)` and the two group arrays. Keep the file the single nav source
- [x] 8.3 [frontend] New `frontend/hooks/use-nav-scope.ts` — derives `{ scope, groups, items, project? }` from `usePathname()`, reading the project's code and name out of the `useProject(id)` cache. Scope comes from the **path**, so project scope renders immediately with a skeleton label and the global nav never flashes
- [x] 8.4 [frontend] `frontend/components/sidebar/nav-groups.tsx` — take items and groups from `useNavScope()` instead of importing the constant; in project scope render the `← All projects` back row and the static project label above the groups. Keep reusing `./nav-item.tsx:NavItem` for every row, disabled rows included — its `Soon` badge and disabled `<span>` are already correct
- [x] 8.5 [frontend] Leave `components/sidebar/mobile-nav.tsx` rendering the same `<NavGroups>`. **Do not give the drawer its own source** — one renderer, one hook, is what stops desktop and mobile drifting
- [x] 8.6 [frontend] Confirm the collapsed rail still tooltips every row and that `NavItem`'s `pathname === item.href` active test matches both `/projects` and `/projects/:id`
Verify: `cd frontend && npx tsc --noEmit && pnpm lint && pnpm build`

## 9. Projects list screen and create modal [req-8] [req-9]
- [x] 9.1 [frontend] New `frontend/app/(app)/projects/page.tsx` — mirrors `mockups/projects-list.html`: header, search input, status segmented control defaulting to **Active**, `＋ New project` button, table, pager
- [x] 9.2 [frontend] Reuse `components/ui/table.tsx` for the list — **not** a hand-rolled `<table>`. Columns per `ui.md`; Timeline is deliberately not a column
- [x] 9.3 [frontend] Reuse `components/ui/input.tsx:Input` for search (debounced, drives the query — never client-side filtering), `components/ui/button.tsx:Button` for every action, `components/ui/badge.tsx:Badge variant="outline"` for the status pill, `components/ui/avatar.tsx` for the member stack with a `+N` overflow chip
- [x] 9.4 [frontend] Row menu with `components/ui/dropdown-menu.tsx`: `Open` always; `Archive` (warning-coloured) on an active project; `Restore` on an archived one; both **disabled for a non-owner**. **No Delete item**
- [x] 9.5 [frontend] Archive and restore go through `hooks/use-confirm.ts:useConfirm` with the new presets from task 11.6 — imperative, no local dialog state, no new JSX
- [x] 9.6 [frontend] Two **separate** empty states per `ui.md` — "No projects yet" (with the create CTA, search disabled) and "No projects match …" (with `Clear filters`, no CTA). One component serving both is the usual bug here
- [x] 9.7 [frontend] Loading = `components/ui/skeleton.tsx:Skeleton` rows **in the real table shape**; error = the `dashboard-error` card shape from `app/(app)/page.tsx` with `Retry`
- [x] 9.8 [frontend] New `frontend/components/projects/create-project-dialog.tsx` — `components/ui/dialog.tsx`, `react-hook-form` + `zodResolver`, schema beside the form with `z.infer`, `components/ui/textarea.tsx` for Objective, a `datalist` of the viewer's existing domains on the Domain input. **Never `watch()`** (React Compiler + `react-hooks/incompatible-library`); busy = `isSubmitting || mutation.isPending`
- [x] 9.9 [frontend] Field-level errors via `setError`: duplicate code under the code input, bad date range on the end date, request failure as a banner from `errors.root` **with every typed value kept**. Success → close, `toast.success`, list refetch
Verify: `/devspec-verify add-projects`

## 10. Project overview screen [req-10]
- [x] 10.1 [frontend] New `frontend/app/(app)/projects/[id]/page.tsx` — mirrors `mockups/project-detail.html`: header (code, name, status badge, `Owner`/`Member` badge, `⚙ Settings` for the owner only), four stat tiles, the Project plan card, the Project summary card
- [x] 10.2 [frontend] New `frontend/constants/project-stages.ts` — the four stages (Context → Discovery plan → Meetings → Requirements) with label, href, `Soon` flag and the literal `0`. One constant per stage so a later change swaps one line for one query. **No health ring, no percentage, no Known / Unknown / Conflicts counters** — `ui.md` cuts them
- [x] 10.3 [frontend] Reuse `components/ui/card.tsx`, `badge.tsx`, `separator.tsx` and the stat-tile shape already in `app/(app)/page.tsx`
- [x] 10.4 [frontend] Archived state: warning ribbon with `Restore` (through `useConfirm`), the plan card frozen reading "Stopped at stage N", the project mark muted
- [x] 10.5 [frontend] Loading = skeletons in the real tile and card shape. Not-found = the shared screen below, for a 404 **and** a 400 from a malformed uuid alike
- [x] 10.6 [frontend] New `frontend/components/projects/project-not-found.tsx` — the one "Project not found" screen with `← Back to projects`, reused by the detail page and the settings route. The sidebar stays in global scope on it
- [x] 10.7 [frontend] Breadcrumb `Projects / <code>` in the top bar
Verify: `/devspec-verify add-projects`

## 11. Project settings screen [req-12]
- [x] 11.1 [frontend] New `frontend/app/(app)/projects/[id]/settings/page.tsx` — three stacked cards in a `max-w-[760px]` column per `mockups/project-settings.html`. A non-owner gets `project-not-found.tsx`
- [x] 11.2 [frontend] Project details card — the same six fields and the same zod schema as the create dialog, rendered inline. `Save changes` disabled until dirty, an `Unsaved changes` badge in the card header once dirty, `Discard` restoring saved values, duplicate code as a field error
- [x] 11.3 [frontend] Members card — `components/ui/avatar.tsx` rows with name, email and a `Badge` role pill; the add-by-email input with its two field errors ("No Clarivo account uses this email address.", "<Name> is already a member of this project."), **never toasts**
- [x] 11.4 [frontend] **No `✕` on the owner row**; the viewer's own row is marked `You`. No ownership-transfer control. Solo state shows the "You're the only member…" hint
- [x] 11.5 [frontend] Danger zone — warning-bordered card with `Archive project`; archived flips it to primary-bordered `Restore project`, disables the details card and member list, and shows the page ribbon
- [x] 11.6 [frontend] Add `confirmArchive`, `confirmRestore`, `confirmRemoveMember` to `frontend/constants/confirm.ts` with the exact copy in `ui.md`, **beside** `confirmDelete` and without touching it. All three route through `useConfirm`; none claims anything is permanently deleted
Verify: `/devspec-verify add-projects`

## 12. Dashboard reflects real projects [req-13]
- [x] 12.1 [frontend] `frontend/app/(app)/page.tsx` — delete `FeedbackDemoCard` (its own `ponytail:` comment asks for exactly this) and delete the Next Meeting card; `Recent projects` takes the full width
- [x] 12.2 [frontend] Wire `Total projects` and `Recent projects` to `useProjects({ status: 'active', pagination: { limit: 5 }, sort: { sortBy: 'updatedAt' } })` — total from the envelope, rows from `items`. **No new endpoint**
- [x] 12.3 [frontend] `Recent projects` rows show customer · domain · member count · updated, link to `/projects/:id`, and `View all →` goes to `/projects`. Archived projects never appear
- [x] 12.4 [frontend] The other three stat tiles read a literal `0` with a `Soon` marker — the same honest-zero rule Overview uses
- [x] 12.5 [frontend] Empty state reuses the list screen's "No projects yet" block with its create CTA
- [x] 12.6 [frontend] Remove `RECENT_PROJECTS`, `NEXT_MEETING` and the projects `Stat` from `frontend/constants/dashboard.ts`, and the now-orphaned `RecentProject` / `NextMeeting` types from `frontend/types/dashboard.ts` — in this same commit. These are orphans **this change creates**, so they go; nothing else in those files is touched
Verify: `/devspec-verify add-projects`

## 13. Conventions, docs and the repo's gates [req-14]
- [x] 13.1 [backend] Re-run `cd frontend && pnpm api:types` if the controller changed after task 6.1, so the generated types match what shipped
- [x] 13.2 [db] Refresh `devspec/context/schema.md` — add `projects` and `project_members` with their columns, and move four items out of "Still not established": enums as `varchar` + CHECK, the first composite unique, the first `date` columns (serialised as `'YYYY-MM-DD'` strings), and the `ON DELETE CASCADE` exception **with the reasoning that keeps RESTRICT the default**
- [x] 13.3 [test] `cd backend && pnpm lint && pnpm test && pnpm build` — all green. **Do not run `pnpm test:e2e`** and do not touch `backend/test/app.e2e-spec.ts`: it is the pre-existing failure logged in `devspec/report/blockers.md` and is out of scope
- [x] 13.4 [frontend] `cd frontend && npx tsc --noEmit && pnpm lint && pnpm build` — all green, warnings included
Verify: `cd backend && pnpm lint && pnpm test && pnpm build && cd ../frontend && npx tsc --noEmit && pnpm lint && pnpm build`
