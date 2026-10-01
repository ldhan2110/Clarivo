# Tasks: add-app-shell

All paths are relative to `frontend/`. `@/*` resolves to the **frontend root** (`frontend/CLAUDE.md`), not to `app/`.

## 1. UI primitives [req-2] [req-3] [req-4] [req-5] [req-7]
The shadcn CLI hangs in this repo (`devspec/context/rules.md`) — copy each component's source from ui.shadcn.com (style `new-york`, baseColor `slate`) into `components/ui/` **by hand**. Every radix dependency these need is already covered by the installed `radix-ui` umbrella package; **do not add an npm dependency**.

- [x] 1.1 [frontend] `components/ui/avatar.tsx` — `Avatar`, `AvatarImage`, `AvatarFallback`
- [x] 1.2 [frontend] `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`
- [x] 1.3 [frontend] `components/ui/card.tsx` — `Card`, `CardHeader`, `CardTitle`, `CardContent`
- [x] 1.4 [frontend] `components/ui/badge.tsx` — `Badge` (used for the `Soon` badge and the meeting pills)
- [x] 1.5 [frontend] `components/ui/skeleton.tsx` — `Skeleton`
- [x] 1.6 [frontend] `components/ui/tooltip.tsx` — `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- [x] 1.7 [frontend] `components/ui/sheet.tsx` — `Sheet`, `SheetTrigger`, `SheetContent`, `SheetTitle` (side `left`, used for the mobile drawer)
- [x] 1.8 [frontend] `components/ui/separator.tsx` — `Separator`
- [x] 1.9 [frontend] Each file imports `cn` from `@/lib/utils` and uses semantic tokens only — no raw hex, no `bg-white`

Verify: `npx tsc --noEmit` clean and `npx eslint components/ui` clean (warnings included)

## 2. Nav data and sidebar context [req-2] [req-3]
- [x] 2.1 [frontend] `components/nav/nav-items.ts` — export `NAV_ITEMS`, one array of `{ group, label, href, icon, disabled }`. Groups in order `Workspace` (Dashboard `/`, Projects, Meetings), `Insights` (Requirements, Questions, Decisions, Documents), `Account` (Settings). Icons from `lucide-react`: `LayoutDashboard`, `FolderKanban`, `CalendarDays`, `ListChecks`, `CircleHelp`, `Scale`, `FileText`, `Settings`. Dashboard is the only entry with `disabled: false`
- [x] 2.2 [frontend] `hooks/use-is-mobile.ts` — `useIsMobile()` returning whether the viewport is under 768px, via `matchMedia`; SSR-safe (no `window` access during render)
- [x] 2.3 [frontend] `components/nav/sidebar-context.tsx` — `"use client"` `SidebarProvider` + `useSidebar()` exposing `{ open, setOpen, toggle, mobileOpen, setMobileOpen }`. Toggling writes the cookie `sidebar_state` (`"true"`/`"false"`, `path=/`, `max-age` 1 year, `SameSite=Lax`). A `keydown` listener toggles on `⌘B` / `Ctrl+B` and calls `preventDefault()`. Add a `// ponytail:` comment naming the ceiling: swap in shadcn's `sidebar` block if a `⌘K` palette or rail-dragging is ever wanted
- [x] 2.4 [frontend] The provider takes the server-read cookie value as `defaultOpen` so the first paint is already correct

Verify: `npx tsc --noEmit` clean; `NAV_ITEMS` has exactly 8 entries, exactly one with `disabled: false`

## 3. Sidebar [req-2] [req-3] [req-8]
- [x] 3.1 [frontend] `components/nav/nav-item.tsx` — renders one `NAV_ITEMS` entry. Enabled → `next/link` `<Link>`; **disabled → a `<span>`, never an anchor**, with `aria-disabled="true"`, `opacity-55`, no hover state, and a `<Badge>` reading `Soon`. Active (via `usePathname()`) → `bg-sidebar-primary/12 text-sidebar-primary font-semibold` plus a 3px left accent bar; `aria-current="page"`
- [x] 3.2 [frontend] `components/nav/app-sidebar.tsx` — the floating card: `m-3 rounded-[18px] border border-sidebar-border bg-sidebar shadow-lg`, width `w-[264px]` expanded / `w-[72px]` collapsed, `transition-[width]`. Header = brand mark + wordmark + collapse button (`PanelLeft`). Body = the three groups with uppercase headings. Footer = `<NavUser>` above a `<Separator>`
- [x] 3.3 [frontend] Collapsed rail: hide labels, badges, wordmark, collapse button and the user's name/role; centre each icon; render group headings as a hairline `<Separator>`; wrap each item in `<Tooltip>` showing its label (tooltips only while collapsed)
- [x] 3.4 [frontend] Semantic tokens only — `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `text-sidebar-primary`, `bg-sidebar-accent`. **No new token in `globals.css`**; every value the mockup uses is already defined there

Verify: `/devspec-verify add-app-shell` (agent-browser at 1280px: sidebar is a card with a radius, border and inset; collapse toggles 264⇄72 and survives reload; `⌘B` toggles; the seven disabled items render no anchor and do not change the URL)

## 4. Footer user block [req-4]
- [x] 4.1 [frontend] `components/nav/nav-user.tsx` — `"use client"`. Reads the user from `@/stores/auth` `useUser()`; sign-out from `@/hooks/use-auth` `useLogout()`. Row = `<Avatar>` with initials fallback (first letters of the first two words of `user.name`, uppercased), name (`font-semibold text-sm`), role underneath (`text-xs text-muted-foreground`), `ChevronsUpDown` at the end
- [x] 4.2 [frontend] Wrap the row in `<DropdownMenu>`; content opens upward (`side="top"`) with a `<DropdownMenuLabel>` carrying the name and e-mail, a disabled `Profile` item with a `Soon` badge, and a `Sign out` item styled `text-destructive` with a `LogOut` icon. **The e-mail appears only in the menu**, never on the row
- [x] 4.3 [frontend] `Sign out` calls the logout mutation, then redirects to `/login`; the control is disabled while the mutation is pending
- [x] 4.4 [frontend] Role text: use `user.role` if the `UserDto` carries one, otherwise the literal `BA` behind a `// ponytail:` comment
- [x] 4.5 [frontend] **Delete `components/auth/user-chip.tsx`** and remove every import of it

Verify: `/devspec-verify add-app-shell` (sign in, open the footer menu, assert the e-mail is in the menu and not on the row, click `Sign out`, land on `/login`); `grep -r user-chip frontend --exclude-dir=node_modules` returns nothing

## 5. Mobile navigation [req-5]
- [x] 5.1 [frontend] `components/nav/mobile-nav.tsx` — `"use client"`. Below 768px render a top bar: `Menu` button, brand, spacer, `Bell`. The button opens `<Sheet side="left">` whose content renders the **same `NAV_ITEMS`** through the same `<NavItem>` — no second nav list
- [x] 5.2 [frontend] Drawer styling matches the mockup: inset 12px, `rounded-[18px]`, its own shadow, over the `Sheet`'s scrim. Closes on scrim click, on its close control, and on `Escape` (the `Sheet` primitive gives the last two)
- [x] 5.3 [frontend] Hide the desktop sidebar below 768px and hide the mobile top bar at and above it, driven by `useIsMobile()`. Crossing the breakpoint must not leave a drawer open over a desktop layout
- [x] 5.4 [frontend] **No bottom tab bar** — do not build one

Verify: `/devspec-verify add-app-shell` (agent-browser at 390px: no persistent sidebar, hamburger opens a drawer with all 8 items in 3 groups, `Escape` closes it, no bottom bar, no horizontal scroll)

## 6. Route group, guard and layout [req-1]
- [x] 6.1 [frontend] `app/(app)/layout.tsx` — a Server Component. Read the `sidebar_state` cookie via `next/headers` `cookies()` and pass it as `defaultOpen` to `<SidebarProvider>`; render `<AppSidebar>` + `<MobileNav>` + a `<main>` holding `children`. Page canvas `bg-muted`, shell `h-dvh` (**never `min-h-screen`**)
- [x] 6.2 [frontend] `components/nav/auth-guard.tsx` — `"use client"`. Reads `status` from `@/stores/auth`: `"unknown"` → render the skeleton shell; `"anonymous"` → `router.replace("/login")` and render nothing; `"authenticated"` → render `children`. **Never redirect while `"unknown"`**
- [x] 6.3 [frontend] `app/layout.tsx` — drop `flex-col` from the `<body>` class list; leave `QueryProvider` and `AuthProvider` as they are
- [x] 6.4 [frontend] Confirm `app/(auth)/login/page.tsx` is untouched and renders with no shell

Verify: `/devspec-verify add-app-shell` (signed out → `/` redirects to `/login`; signed in → `/` renders the shell; `/login` has no sidebar; reload with the sidebar collapsed shows no expand-then-collapse flash)

## 7. Dashboard [req-6] [req-7]
- [x] 7.1 [frontend] **Delete `app/page.tsx`** (the Next.js scaffold). `/` is served by `app/(app)/page.tsx` from here on — two files must not own the route
- [x] 7.2 [frontend] `app/(app)/page.tsx` — greeting ("Good morning / afternoon / evening" from the client clock + `user.name` + 👋) over the subtitle `Here's what's happening with your projects.`
- [x] 7.3 [frontend] Stat row — four `<Card>`s, `grid-cols-4` desktop / `grid-cols-2` mobile: Total Projects `3`, Meetings `12`, Requirements `48`, Open Questions `7`. Each = value `text-2xl font-bold` over a `text-muted-foreground` label, plus a 34px tinted rounded square holding the section icon (tints from `--chart-1`, `--chart-2`, `--chart-3`, `--chart-5`)
- [x] 7.4 [frontend] `Recent Projects` `<Card>` — three rows (gradient tile, name, `Last meeting: <date> · N requirements`, `ChevronRight`), hairline between rows, hover highlight, a `View all` link in the header. Values exactly as in `ui.md`
- [x] 7.5 [frontend] `Next Meeting` `<Card>` — title, `Oct 2, 2026 · 10:00 AM`, two `<Badge>` pills (`3 topics`, `5 questions`), a full-width `<Button>` reading `View details`
- [x] 7.6 [frontend] Sample data sits in this file behind a `// ponytail:` comment naming the swap (a `services/dashboard.ts` + `hooks/use-dashboard.ts` pair once endpoints exist). **Do not create a service that returns hardcoded data**
- [x] 7.7 [frontend] Inert controls (`View all`, `View details`, chevrons, bell) render with no `href` and no handler — **never `href="#"`**
- [x] 7.8 [frontend] Loading state — `<Skeleton>` placeholders for the stat cards, both content cards and the footer user block, shown while the auth status is `"unknown"`
- [x] 7.9 [frontend] Empty state — stats show `0`; each content card shows icon + heading + one line ("No projects yet" / "Nothing scheduled"); subtitle becomes "Nothing here yet — create your first project to get started."
- [x] 7.10 [frontend] Error state — shell intact, content region replaced by `TriangleAlert` + "Couldn't load your dashboard" + one line + a `<Button variant="outline">Retry</Button>`. A 401 is **not** this state: it clears the auth store and redirects to `/login`

Verify: `/devspec-verify add-app-shell` (all four dashboard regions present and non-plain; greeting names the signed-in user; no Next.js/Vercel scaffold text anywhere; empty and error states render correctly when the local constant is flipped)

## 8. Definition of done [req-8]
- [x] 8.1 [frontend] `npx tsc --noEmit` clean
- [x] 8.2 [frontend] `npx eslint app components hooks` clean — warnings included, `react-hooks/incompatible-library` included
- [x] 8.3 [frontend] `pnpm build` succeeds
- [x] 8.4 [frontend] `git diff frontend/app/globals.css` is empty — this change defines no new token
- [x] 8.5 [frontend] No raw hex, no `bg-white`/`bg-black`, no `min-h-screen` in any file this change added or edited
- [x] 8.6 [frontend] Measured in the running app (dev server `:3001`, API `:3000`) at 390px, 768px and 1280px: no horizontal scroll at any width; dark theme legible with nothing left on a light background

Verify: `/devspec-verify add-app-shell` plus the three commands above, with the measured values reported
