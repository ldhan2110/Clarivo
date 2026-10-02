import {
  CalendarDays,
  CircleHelp,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Scale,
  Settings,
  SquareKanban,
} from "lucide-react";
import type { NavGroup, NavItemDef } from "@/types/nav";

/**
 * The one nav source, in two scopes. The desktop sidebar and the mobile drawer
 * both render whatever `useNavScope()` picks from here, through one
 * <NavGroups> — which is what stops the two from ever drifting apart. Giving
 * the drawer its own source is the defect to watch for.
 *
 * Outside a project the nav is global; inside /projects/:id it swaps to that
 * project's sections. Meetings / Requirements / Questions / Decisions /
 * Documents used to be global rows; they are project-scoped nouns now.
 */
export const GLOBAL_NAV_ITEMS: NavItemDef[] = [
  { group: "Workspace", label: "Dashboard", href: "/", icon: LayoutDashboard, disabled: false },
  { group: "Workspace", label: "Projects", href: "/projects", icon: FolderKanban, disabled: false },
  { group: "Account", label: "Settings", href: "/settings", icon: Settings, disabled: true },
];

export const GLOBAL_NAV_GROUPS: NavGroup[] = ["Workspace", "Account"];

/** The owner-only Settings row is appended, not filtered — a member never sees it. */
export function projectNavItems(id: string, isOwner: boolean): NavItemDef[] {
  const base = `/projects/${id}`;
  const items: NavItemDef[] = [
    { group: "Plan", label: "Overview", href: base, icon: SquareKanban, disabled: false },
    { group: "Plan", label: "Context", href: `${base}/context`, icon: FileText, disabled: false },
    { group: "Plan", label: "Discovery Plan", href: `${base}/discovery`, icon: ListChecks, disabled: true },
    { group: "Run", label: "Meetings", href: `${base}/meetings`, icon: CalendarDays, disabled: true },
    { group: "Output", label: "Requirements", href: `${base}/requirements`, icon: ListChecks, disabled: true },
    { group: "Output", label: "Questions", href: `${base}/questions`, icon: CircleHelp, disabled: true },
    { group: "Output", label: "Decisions", href: `${base}/decisions`, icon: Scale, disabled: true },
  ];

  if (isOwner) {
    items.push({
      group: "Project",
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      disabled: false,
    });
  }
  return items;
}

export const PROJECT_NAV_GROUPS: NavGroup[] = ["Plan", "Run", "Output", "Project"];
