import { CalendarDays, FileText, ListChecks, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Clarivo's pipeline: Context → Discovery plan → Meetings → Requirements.
 *
 * Every count here is a FRONTEND CONSTANT, not an API field, and every one is
 * a genuine 0 — the context, meetings and requirements tables do not exist
 * yet. An API returning `requirementsCount: 0` from a table that does not
 * exist is a field that lies by construction, and the next change would have
 * to decide whether the old zero was real.
 *
 * One constant per stage, so add-project-context / add-meetings /
 * add-requirements each swap one line for one query and the page never moves.
 */
export type ProjectStage = {
  label: string;
  /** Tile caption on Overview. */
  tile: string;
  /** Row caption in the plan card. */
  detail: string;
  /** Appended to /projects/:id. */
  path: string;
  icon: LucideIcon;
  count: number;
  soon: boolean;
};

export const PROJECT_STAGES: ProjectStage[] = [
  {
    label: "Add context documents",
    tile: "Context documents",
    detail: "0 files",
    path: "/context",
    icon: FileText,
    count: 0,
    soon: true,
  },
  {
    label: "Generate discovery plan",
    tile: "Meetings held",
    detail: "—",
    path: "/discovery",
    icon: Sparkles,
    count: 0,
    soon: true,
  },
  {
    label: "Run the meetings",
    tile: "Requirements collected",
    detail: "0 of 0 held",
    path: "/meetings",
    icon: CalendarDays,
    count: 0,
    soon: true,
  },
  {
    label: "Draft the requirements",
    tile: "Open questions",
    detail: "0 drafted",
    path: "/requirements",
    icon: ListChecks,
    count: 0,
    soon: true,
  },
];

/** Stage 1 of 4 until anything downstream ships. */
export const CURRENT_STAGE = 1;
