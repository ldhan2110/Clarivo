import type { LucideIcon } from "lucide-react";

export type NavGroup =
  | "Workspace"
  | "Account"
  | "Plan"
  | "Run"
  | "Output"
  | "Project";

export type NavItemDef = {
  group: NavGroup;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled: boolean;
};

export type NavScope = "global" | "project";
