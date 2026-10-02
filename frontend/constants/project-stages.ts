import { CalendarDays, FileText, ListChecks, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Clarivo's pipeline: Context → Discovery plan → Meetings → Requirements.
 *
 * Stage 1 now reads a real document count (see `projectStages` below) because
 * `project_documents` exists. The other three are still FRONTEND CONSTANTS at
 * a genuine 0 — those tables do not exist, and an API returning
 * `requirementsCount: 0` from a table that is not there is a field that lies by
 * construction, leaving the next change to decide whether the old zero was real.
 *
 * One constant per stage, so add-meetings / add-requirements each swap one line
 * for one query and the page never moves.
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
    soon: false,
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

/**
 * The stage list with stage 1's count, detail and `soon` read from the real
 * document count. The other three stay exactly as declared above — honest
 * zeros for tables that do not exist yet.
 */
export function projectStages(documentCount: number): ProjectStage[] {
  return PROJECT_STAGES.map((stage, index) =>
    index === 0
      ? {
          ...stage,
          count: documentCount,
          detail: `${documentCount} ${documentCount === 1 ? "file" : "files"}`,
          soon: false,
        }
      : stage,
  );
}
