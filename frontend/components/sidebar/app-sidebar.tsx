"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { NavGroups } from "./nav-groups";
import { NavUser } from "./nav-user";
import { useSidebar } from "./sidebar-context";

/**
 * A floating card over the page canvas — rounded, bordered, shadowed — not a
 * flush panel. Collapses to a 72px icon rail.
 */
export function AppSidebar() {
  const { open, toggle } = useSidebar();
  const collapsed = !open;

  return (
    <aside
      data-testid="app-sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "z-20 hidden shrink-0 flex-col rounded-[18px] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg transition-[width] duration-200 md:flex",
        "my-3 ml-3",
        collapsed ? "w-[72px]" : "w-[264px]",
      )}
    >
      <div className={cn("flex h-[60px] shrink-0 items-center px-3.5", collapsed && "justify-center px-0")}>
        {/* Collapsed, the mark itself is the expand control: a rail with no
            way back left ⌘B as the only one. */}
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            title="Expand sidebar (⌘B)"
            className="flex size-9 items-center justify-center rounded-[10px] transition-colors hover:bg-sidebar-accent"
          >
            <Brand wordmark={false} />
          </button>
        ) : (
          <>
            <Brand />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar (⌘B)"
              className="ml-auto text-muted-foreground"
            >
              <PanelLeft />
            </Button>
          </>
        )}
      </div>

      <NavGroups collapsed={collapsed} />

      <div className="shrink-0 p-2.5">
        <Separator className="mb-2.5 bg-sidebar-border" />
        <NavUser collapsed={collapsed} />
      </div>
    </aside>
  );
}
