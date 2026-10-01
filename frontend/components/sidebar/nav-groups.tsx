"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavScope } from "@/hooks/use-nav-scope";
import { cn } from "@/lib/utils";
import { NavItem } from "./nav-item";

/** Collapsed, every rail row must still name itself — same rule as NavItem. */
function backRow(collapsed: boolean, onNavigate?: () => void) {
  const row = (
    <Link
      href="/projects"
      onClick={onNavigate}
      aria-label="All projects"
      className={cn(
        "flex h-9.5 items-center gap-3 rounded-[10px] px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent",
        collapsed && "justify-center px-0",
      )}
    >
      <ArrowLeft className="size-[18px] shrink-0" />
      {!collapsed && <span className="truncate">All projects</span>}
    </Link>
  );

  if (!collapsed) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">All projects</TooltipContent>
    </Tooltip>
  );
}

/**
 * The one renderer. Desktop (app-sidebar) and the mobile drawer (mobile-nav)
 * both mount this, and it takes its items and groups from useNavScope() — so
 * the two shells cannot drift apart. Do not give either one its own source.
 */
export function NavGroups({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { scope, groups, items, project } = useNavScope();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pt-1 pb-2.5">
      {scope === "project" && project && (
        <>
          {backRow(collapsed, onNavigate)}

          {/* A static label, not a dropdown: "All projects" above already
              covers navigation, so a switcher would be a second list query
              for no new capability. */}
          {!collapsed && (
            <div
              data-testid="nav-project-label"
              className="mt-1.5 flex items-center gap-2.5 rounded-[10px] bg-sidebar-accent px-2.5 py-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-sidebar-primary/15 text-[11px] font-semibold text-sidebar-primary">
                {project.code ? project.code.slice(0, 2).toUpperCase() : "··"}
              </span>
              {project.code ? (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-semibold text-sidebar-foreground">
                    {project.code}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">{project.name}</span>
                </span>
              ) : (
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </span>
              )}
            </div>
          )}
        </>
      )}

      {groups.map((group) => {
        const rows = items.filter((i) => i.group === group);
        // A group with no items would render a bare header — the exact failure
        // a leftover "Insights" member used to cause.
        if (rows.length === 0) return null;

        return (
          <div key={group} className="contents">
            {collapsed ? (
              <Separator className="my-2 bg-sidebar-border" />
            ) : (
              <span className="px-2 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
                {group}
              </span>
            )}
            {rows.map((item) => (
              <NavItem key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
