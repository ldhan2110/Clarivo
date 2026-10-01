import {
  CalendarDays,
  CircleHelp,
  FolderKanban,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

// ponytail: the dashboard has no endpoints yet, so these are constants in the
// route that renders them. When /dashboard lands, this becomes a
// services/dashboard.ts + hooks/use-dashboard.ts pair per the layer law in
// frontend/CLAUDE.md — deliberately NOT a service returning hardcoded data.

export type Stat = { label: string; value: number; icon: LucideIcon; tint: string };

export const STATS: Stat[] = [
  { label: "Total Projects", value: 3, icon: FolderKanban, tint: "bg-chart-1/14 text-chart-1" },
  { label: "Meetings", value: 12, icon: CalendarDays, tint: "bg-chart-2/16 text-chart-2" },
  { label: "Requirements", value: 48, icon: ListChecks, tint: "bg-chart-3/14 text-chart-3" },
  { label: "Open Questions", value: 7, icon: CircleHelp, tint: "bg-chart-5/20 text-chart-5" },
];

export type RecentProject = { name: string; lastMeeting: string; requirements: number };

export const RECENT_PROJECTS: RecentProject[] = [
  { name: "CLT-DevSpec", lastMeeting: "Sep 30, 2026", requirements: 12 },
  { name: "Caris Logistics", lastMeeting: "Sep 28, 2026", requirements: 8 },
  { name: "HRM-X", lastMeeting: "Sep 25, 2026", requirements: 5 },
];

export const NEXT_MEETING = {
  title: "Caris Logistics — Business Rules",
  when: "Oct 2, 2026 · 10:00 AM",
  pills: ["3 topics", "5 questions"],
};

/** Flip to exercise the empty / error branches until real data exists. */
export type DataState = "ready" | "empty" | "error";
export const DATA_STATE: DataState = "ready";
