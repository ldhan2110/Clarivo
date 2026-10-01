import { cn } from "@/lib/utils";

export function Brand({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-linear-140 from-chart-2 via-chart-1 to-chart-3 text-sm font-extrabold text-primary-foreground"
      >
        C
      </span>
      {wordmark && (
        <span className="truncate text-base font-bold tracking-tight">Clarivo</span>
      )}
    </span>
  );
}
