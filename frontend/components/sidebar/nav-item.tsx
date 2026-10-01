"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavItemDef } from "./nav-items";

type Props = {
  item: NavItemDef;
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function NavItem({ item, collapsed = false, onNavigate }: Props) {
  const pathname = usePathname();
  const active = !item.disabled && pathname === item.href;
  const Icon = item.icon;

  const base = cn(
    "relative flex h-9.5 items-center gap-3 rounded-[10px] px-2.5 text-sm font-medium",
    collapsed && "justify-center px-0",
  );

  if (item.disabled) {
    // A disabled <span>, never an anchor — a disabled <Link> still navigates.
    const row = (
      <span
        aria-disabled="true"
        data-disabled="true"
        className={cn(base, "cursor-default text-sidebar-foreground opacity-55")}
      >
        <Icon className="size-[18px] shrink-0 text-muted-foreground" />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            <Badge variant="outline" className="ml-auto text-[10px] tracking-wide uppercase">
              Soon
            </Badge>
          </>
        )}
      </span>
    );

    return collapsed ? withTooltip(row, `${item.label} · Soon`) : row;
  }

  const row = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : undefined}
      className={cn(
        base,
        "text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-primary/12 font-semibold text-sidebar-primary hover:bg-sidebar-primary/12",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r-[3px] bg-sidebar-primary"
        />
      )}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "text-muted-foreground")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return collapsed ? withTooltip(row, item.label) : row;
}

function withTooltip(trigger: React.ReactNode, label: string) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
