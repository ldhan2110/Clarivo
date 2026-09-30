@AGENTS.md

# Clarivo frontend — patterns to follow on every task

Next 16 App Router, React 19 + React Compiler, Tailwind v4, TanStack Query v5,
axios, react-hook-form + zod. `@/*` resolves from the frontend root (`@/lib/api`,
`@/services/auth`), not from `app/`.

## Layer boundaries

One direction only: `component → hooks/ → services/ → lib/api`.

| Folder | Holds | Never holds |
|---|---|---|
| `services/` | one function per endpoint, returns unwrapped `data`, typed from `@/types/api` | React, hooks, toasts, routing |
| `hooks/` | `useQuery` / `useMutation` wrappers, query keys, error→message mappers | axios calls, JSX |
| `components/ui/` | shadcn-style primitives | feature logic, fetching |
| `app/**/page.tsx` | layout, form wiring, navigation | axios calls, raw `fetch`, response shaping |

A component never calls `api.*` directly. A service never imports from `hooks/`.

```ts
// services/auth.ts — API surface, no React
export async function login(body: LoginDto) {
  const { data } = await api.post<UserDto>("/auth/login", body);
  return data;
}

// hooks/use-auth.ts — react-query surface
export function useLogin() { return useMutation({ mutationFn: login }); }
```

Request/response types come from `types/api` (generated — `pnpm api:types`). Never
hand-write a DTO that already exists there.

## Forms

react-hook-form + `zodResolver`. No `useState` per field, no hand-rolled validators.

- zod schema next to the form; infer the type (`z.infer<typeof schema>`) — don't declare it twice.
- Validation messages live in the schema, not in JSX.
- Server errors → `setError("root", { message })`, rendered from `errors.root`.
- Busy = `isSubmitting || mutation.isPending`; disable inputs and the submit button with it.
- Controlled primitives (Checkbox, Select, RadioGroup) use `<Controller>`. **Never `watch()`** — React Compiler can't memoize it and ESLint fails with `react-hooks/incompatible-library`.
- `useState` in a form is for UI-only state (password visibility, open/closed), never field values.

Auth errors stay generic: a 401 must not reveal whether the email exists.

## Styling

- Tailwind utilities in JSX; semantic tokens only (`bg-card`, `text-muted-foreground`, `border-border`) — no raw hex, no `bg-white`.
- Named breakpoints over arbitrary variants. Tailwind emits named variants *after* arbitrary ones, so mixing `sm:` with `min-[900px]:` lets the narrower rule win. Declare a token in `globals.css` (`--breakpoint-panel`, `@custom-variant short`) and use `panel:` / `short:`.
- Full-viewport screens: `h-dvh`, never `min-h-screen` — `100vh` exceeds the visible area on mobile and forces a scroll.
- Mark deliberate simplifications and their ceiling with a `// ponytail:` comment.

## Definition of done

1. `npx tsc --noEmit` clean.
2. `npx eslint <changed paths>` clean — warnings included.
3. Behaviour proved in the running app, not just reasoned about: drive it with `agent-browser` (dev server on :3001, API on :3000) and report the measured values.
   `agent-browser set viewport` only applies on the first call per session — restart the session for each size.
