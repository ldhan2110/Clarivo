# Design: add-app-shell

## Architecture

```
app/layout.tsx  (html > body, QueryProvider > AuthProvider)
   │
   ├── app/(auth)/login/page.tsx                       ← untouched, no shell
   │
   └── app/(app)/layout.tsx          AuthGuard ─ reads stores/auth.ts status
          │                             ├ "unknown"        → <ShellSkeleton/>  (never redirect)
          │                             ├ "anonymous"      → router.replace("/login")
          │                             └ "authenticated"  → shell
          │
          ├── SidebarProvider (context: open, toggle, isMobile)
          │      └ cookie "sidebar_state" ← written on toggle, read by the server layout
          │
          ├── AppSidebar          ≥768px: floating card, 264 ⇄ 72
          │      ├ NAV_ITEMS (components/nav/nav-items.ts) — one array, three groups
          │      ├ NavItem × 8   (active = usePathname(); 7 disabled + Soon badge)
          │      └ NavUser       → stores/auth.ts useUser · hooks/use-auth.ts useLogout
          │
          ├── MobileNav           <768px: hamburger in the top bar → <Sheet> drawer,
          │                       renders the SAME NAV_ITEMS array
          │
          └── app/(app)/page.tsx  dashboard — static sample data, no fetch
                 └ Greeting · StatCard ×4 · RecentProjects · NextMeeting
```

Nothing in `backend/` is touched. No HTTP call is added: the shell reads the auth store that `add-login` already hydrates from `/auth/me`, and the dashboard's numbers are hardcoded.

## Decisions

### Hand-roll the sidebar rather than vendor shadcn's `sidebar` block

`devspec/context/rules.md` records that **the shadcn CLI hangs in this environment** — every component has to be transcribed by hand. That changes the arithmetic:

| | shadcn `sidebar` block | hand-rolled |
|---|---|---|
| lines to transcribe | ~1010 (`sidebar.tsx` ~760 + `sheet`, `tooltip`, `separator`, `skeleton`, `use-mobile`) | ~185 written |
| of which this change uses | roughly half | all |
| features cut by this change | search box, rail drag, bottom bar, `⌘K` — all unused | not built |
| failure mode | silent transcription error in code nobody here wrote | ordinary bug in our own code |

Chosen: **hand-roll**. The block's value is the parts this change explicitly cut. A `// ponytail:` comment on the provider names the ceiling: if a `⌘K` palette or rail-dragging is ever wanted, swap in the real block then — ideally once the CLI works.

The eight *small* primitives (`avatar`, `dropdown-menu`, `card`, `badge`, `skeleton`, `tooltip`, `sheet`, `separator`) are still copied from shadcn by hand — they are ~60 lines each, carry accessibility behaviour worth not reinventing, and every radix dependency they need is already covered by the installed `radix-ui` umbrella package. No new npm dependency is added by this change.

### Collapse state in a cookie, not `localStorage`

The layout is a Server Component. A cookie is readable during SSR, so the first paint already has the right width; `localStorage` is client-only and would render 264px then snap to 72px. Cookie name `sidebar_state`, value `"true"`/`"false"`, `path=/`, `max-age` one year, `SameSite=Lax`. It holds no user data and is not security-relevant.

### Guard in the `(app)` layout, not in middleware

The session cookie is `httpOnly`, so middleware could check its *presence* but not its validity, and would duplicate a decision the auth store already makes correctly. The store's three-state `status` exists precisely for this (`stores/auth.ts`): `"unknown"` means `/auth/me` has not answered, and redirecting then would bounce a signed-in user to `/login` on every reload. The guard therefore renders a skeleton while `"unknown"`, and only redirects on `"anonymous"`.

### One nav array, three consumers

`components/nav/nav-items.ts` exports a single `NAV_ITEMS` array (group, label, href, icon, `disabled`). The desktop sidebar, the mobile drawer and any future breadcrumb read it. Adding a section later is a one-line edit, and the desktop and mobile navs cannot drift apart.

### `Soon` items are not links

A disabled item renders as a `<span>`, not an `<a>`/`<Link>` — no href, no hover state, `aria-disabled="true"`. A disabled `<Link>` that still navigates is the usual bug here; not emitting an anchor at all removes the possibility.

### Static sample data lives in the page, not a service

No endpoint exists for any dashboard number. Creating a `services/dashboard.ts` that returns hardcoded objects would put a fake in the layer that is supposed to be the real API surface. The sample values sit in `app/(app)/page.tsx` behind a `// ponytail:` comment naming the swap: when the endpoints land, they become a `hooks/use-dashboard.ts` + `services/dashboard.ts` pair per the layer law in `frontend/CLAUDE.md`.

The dashboard's loading / empty / error states are specced and built even though nothing can currently trigger them, because the layout differs per state and the shape should be settled before data arrives. They are reachable in the built app only by the auth store's `"unknown"` phase (loading); empty and error are rendered from a local constant the worker flips to verify, not from a URL flag.

## Rejected

- **`⌘K` command palette + sidebar search** — cut with the user during exploration. A palette is a feature, not chrome; a search box that searches nothing is worse than none.
- **Mobile bottom tab bar** (reference screen 15) — cut. It is marked "optional" in the mockup itself, duplicates the drawer's job, and needs its own active-state logic. The drawer is free with `Sheet`.
- **Stub pages for the seven unbuilt sections** — rejected. Seven files whose only content is "coming soon" are seven files to delete later; the `Soon` badge says the same thing from one array entry.
- **`localStorage` for collapse state** — see above, causes a first-paint flash.
- **Middleware auth guard** — see above, cannot validate an `httpOnly` cookie.
- **Theme toggle** — the dark palette is honoured because the tokens exist, but adding a switcher is its own change (needs persistence, an SSR-safe class, and a control to live somewhere).

## Conventions followed, and one conflict

Followed, per `frontend/CLAUDE.md`:

- Layer law `component → hooks/ → services/ → lib/api`. This change adds no service and no hook; it consumes `stores/auth.ts` and `hooks/use-auth.ts` as they are.
- Semantic tokens only — `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `bg-card`, `text-muted-foreground`. No raw hex anywhere. `ui.md` confirms every value in the approved mockup came from `globals.css`.
- Full-viewport screens use `h-dvh`, never `min-h-screen`.
- Named breakpoints over arbitrary variants. The mobile cut is at Tailwind's own `md` (768px), so no new token is needed; `--breakpoint-panel` and the `short` variant are untouched.
- `"use client"` pushed as low as possible: the `(app)` layout is a Server Component that reads the cookie and renders the client `SidebarProvider` around `children`.
- `// ponytail:` comments mark the deliberate simplifications named above.

**Conflict — `devspec/context/conventions.md` is stale on the frontend.** It states that everything lives under `app/` and that `@/*` resolves to `./app/*`. Both were changed by `add-login`: `@/*` now resolves to the **frontend root**, and `components/`, `hooks/`, `services/`, `stores/`, `lib/` sit at the root beside `app/`. `frontend/CLAUDE.md` is human-written and current, so it wins; this change follows the root layout. Refreshing `devspec/context/conventions.md` is a separate job and is **not** in this change's scope.

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if the default doesn't fit |
|---|---|---|
| Where the shell components live | `frontend/components/nav/` — new folder, kebab-case files, PascalCase exports | mirror the existing `components/auth/` folder shape |
| Where the collapse context lives | `components/nav/sidebar-context.tsx`, a `"use client"` provider + `useSidebar()` hook | colocate in `app-sidebar.tsx` if it stays under ~30 lines |
| Breakpoint for the mobile swap | Tailwind `md` (768px), via a `useIsMobile()` hook using `matchMedia` | if a named token is wanted later, declare it in `globals.css`, never an arbitrary variant |
| Icons for each nav item | the `lucide-react` names listed in `ui.md` | nearest lucide equivalent; never an inline SVG |
| Greeting wording | "Good morning / afternoon / evening, `{user.name}` 👋" from the client clock | if `user.name` is missing, fall back to "Good morning 👋" with no name |
| Avatar when the user has no image | initials from `user.name`, first letters of the first two words, uppercased | single word → its first two letters; nothing usable → `<User>` icon |
| Role text under the name | `user.role` if the `UserDto` carries one | the literal `BA`, matching the mockup, behind a `// ponytail:` comment |
| Sample data values | exactly the numbers in `ui.md` (3 / 12 / 48 / 7, the three named projects, the Oct 2 meeting) | — |
| What inert controls do | `View all`, `View details`, the chevrons and the bell render and do nothing — no `href`, no handler | never a `#` href, which pushes a history entry |
| Dates shown on the dashboard | hardcoded strings exactly as in `ui.md` — no `Intl`, no date library | — |
| Shipping a shadcn primitive that needs a radix package | the installed `radix-ui` umbrella already provides it — import from `radix-ui` | if a primitive genuinely needs a package the umbrella lacks, stop and flag; adding a dependency is out of scope |
| Where the deleted `UserChip` import is referenced | only `app/page.tsx`, which this change deletes | if `tsc` finds another importer, update it rather than keeping the file |
| Empty / error states being unreachable | build them, verify by temporarily flipping the local constant, leave the constant at its real value | — |

### Blast Radius

Resolved against the working tree (the frontend is not in the code graph — `summary.md`: the graph covers `backend/` only).

- `frontend/app/(app)/layout.tsx` (new — guard + shell) — safe/reversible
- `frontend/app/(app)/page.tsx` (new — dashboard) — safe/reversible
- `frontend/app/page.tsx` (**deleted** — its route moves to `(app)/page.tsx`) — safe/reversible
- `frontend/app/layout.tsx` (adjust — drop `flex-col` from `<body>`) — safe/reversible
- `frontend/components/auth/user-chip.tsx` (**deleted** — absorbed by `NavUser`) — safe/reversible
- `frontend/components/nav/*` (new — `nav-items.ts`, `sidebar-context.tsx`, `app-sidebar.tsx`, `nav-item.tsx`, `nav-user.tsx`, `mobile-nav.tsx`) — safe/reversible
- `frontend/components/ui/{avatar,dropdown-menu,card,badge,skeleton,tooltip,sheet,separator}.tsx` (new — hand-copied) — safe/reversible
- `frontend/hooks/use-is-mobile.ts` (new) — safe/reversible
- `frontend/app/globals.css` — **read only.** Every token this change needs already exists; nothing is added or changed — safe/reversible
- `frontend/stores/auth.ts`, `frontend/hooks/use-auth.ts`, `frontend/components/ui/button.tsx` — **read only**, consumed unchanged — safe/reversible
- `frontend/app/(auth)/login/page.tsx` — **not touched**; it stays outside the `(app)` group — safe/reversible
- `backend/**` — **not touched**. No endpoint, entity, migration or env var — safe/reversible

No destructive operation, no database work, no security surface. The two deletions are source files whose content is absorbed elsewhere in the same change and recoverable from git.
