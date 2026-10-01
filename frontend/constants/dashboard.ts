import { CalendarDays, CircleHelp, ListChecks } from "lucide-react";
import type { DataState, Stat } from "@/types/dashboard";

// ponytail: these three tiles have no table behind them yet, so they read a
// true 0 with a Soon marker — the same honest-zero rule Overview uses. Each
// becomes one query as add-meetings / add-requirements land, and the row never
// gets rebuilt. Total projects is real data, from the projects list endpoint.

export const SOON_STATS: Stat[] = [
  { label: "Meetings", value: 0, icon: CalendarDays, tint: "bg-chart-2/16 text-chart-2" },
  { label: "Requirements", value: 0, icon: ListChecks, tint: "bg-chart-3/14 text-chart-3" },
  { label: "Open Questions", value: 0, icon: CircleHelp, tint: "bg-chart-5/20 text-chart-5" },
];

export const DATA_STATE: DataState = "ready";
