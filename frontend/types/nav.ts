import type { LucideIcon } from "lucide-react";

export type NavGroup = "Workspace" | "Insights" | "Account";

export type NavItemDef = {
  group: NavGroup;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled: boolean;
};
