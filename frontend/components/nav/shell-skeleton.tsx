import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Brand } from "./brand";
import { NavUserSkeleton } from "./nav-user";

/**
 * Rendered while the session is still "unknown". The nav chrome is real so the
 * page does not jump once /auth/me answers; only identity and content wait.
 */
export function ShellSkeleton() {
  return (
    <div className="flex h-dvh w-full bg-muted" data-testid="shell-skeleton">
      <aside className="my-3 ml-3 hidden w-[264px] shrink-0 flex-col rounded-[18px] border border-sidebar-border bg-sidebar shadow-lg md:flex">
        <div className="flex h-[60px] shrink-0 items-center px-3.5">
          <Brand />
        </div>
        <div className="flex-1 space-y-2 px-4 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <div className="shrink-0 p-2.5">
          <Separator className="mb-2.5 bg-sidebar-border" />
          <NavUserSkeleton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[58px] shrink-0 items-center px-5">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="flex-1 space-y-6 px-5 pb-10 md:px-6.5">
          <div className="space-y-2.5">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-3.5 w-75" />
          </div>
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <Skeleton className="h-60 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
