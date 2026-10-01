"use client";

import { Separator } from "@/components/ui/separator";
import { NavItem } from "./nav-item";
import { NAV_GROUPS, NAV_ITEMS } from "@/constants/nav";

/** The three groups, rendered from the one NAV_ITEMS array. */
export function NavGroups({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pt-1 pb-2.5">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="contents">
          {collapsed ? (
            <Separator className="my-2 bg-sidebar-border" />
          ) : (
            <span className="px-2 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
              {group}
            </span>
          )}
          {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
            <NavItem key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
