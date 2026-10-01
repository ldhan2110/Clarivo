import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The horizontal lockup: the real mark plus a text wordmark. public/images/
 * clarivo-logo.png is a *stacked* lockup on a white plate, so it can't sit in a
 * 60px header row — the mark asset is the one that composes, same as the login
 * page does.
 */
export function Brand({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/images/clarivo-mark.png"
        alt="Clarivo"
        width={190}
        height={190}
        priority
        className="size-7 shrink-0"
      />
      {wordmark && (
        <span className="truncate text-base font-bold tracking-tight">Clarivo</span>
      )}
    </span>
  );
}
