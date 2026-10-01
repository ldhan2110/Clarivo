"use client";

import { usePathname } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import {
  GLOBAL_NAV_GROUPS,
  GLOBAL_NAV_ITEMS,
  PROJECT_NAV_GROUPS,
  projectNavItems,
} from "@/constants/nav";
import type { NavGroup, NavItemDef, NavScope } from "@/types/nav";

/** `/projects/<uuid>` and anything below it, but not `/projects` itself. */
const PROJECT_PATH = /^\/projects\/([^/]+)(?:\/|$)/;

export type NavScopeState = {
  scope: NavScope;
  groups: NavGroup[];
  items: NavItemDef[];
  project?: { id: string; code?: string; name?: string; loading: boolean };
};

/**
 * The one scope decision, taken from the PATHNAME rather than from loaded data.
 * Choosing on data would render the global nav first and flash the wrong nav
 * the moment a project page opens; choosing on the path renders project scope
 * immediately, with a skeleton label until the detail query lands.
 */
export function useNavScope(): NavScopeState {
  const pathname = usePathname();
  const id = PROJECT_PATH.exec(pathname)?.[1] ?? "";

  // Reads the cache the detail page already fills, so entering a project costs
  // no extra request.
  const { data, isLoading } = useProject(id);

  if (!id) {
    return { scope: "global", groups: GLOBAL_NAV_GROUPS, items: GLOBAL_NAV_ITEMS };
  }

  return {
    scope: "project",
    groups: PROJECT_NAV_GROUPS,
    items: projectNavItems(id, data?.viewerRole === "owner"),
    project: { id, code: data?.code, name: data?.name, loading: isLoading },
  };
}
