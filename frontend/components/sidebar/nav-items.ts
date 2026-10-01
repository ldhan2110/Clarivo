import {
  CalendarDays,
  CircleHelp,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Scale,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "Workspace" | "Insights" | "Account";

export type NavItemDef = {
  group: NavGroup;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled: boolean;
};

/**
 * The one nav source. The desktop sidebar and the mobile drawer both render
 * this array, so the two can never drift apart. Everything but Dashboard is
 * unbuilt and renders as a disabled row with a "Soon" badge.
 */
export const NAV_ITEMS: NavItemDef[] = [
  { group: "Workspace", label: "Dashboard", href: "/", icon: LayoutDashboard, disabled: false },
  { group: "Workspace", label: "Projects", href: "/projects", icon: FolderKanban, disabled: true },
  { group: "Workspace", label: "Meetings", href: "/meetings", icon: CalendarDays, disabled: true },
  { group: "Insights", label: "Requirements", href: "/requirements", icon: ListChecks, disabled: true },
  { group: "Insights", label: "Questions", href: "/questions", icon: CircleHelp, disabled: true },
  { group: "Insights", label: "Decisions", href: "/decisions", icon: Scale, disabled: true },
  { group: "Insights", label: "Documents", href: "/documents", icon: FileText, disabled: true },
  { group: "Account", label: "Settings", href: "/settings", icon: Settings, disabled: true },
];

export const NAV_GROUPS: NavGroup[] = ["Workspace", "Insights", "Account"];
