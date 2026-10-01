import type { ProjectSortDto } from "@/types/api";

/**
 * View-model-only shapes. Anything the generated `@/types/api` already covers
 * is deliberately not re-declared here.
 */

export type ProjectStatusFilter = "active" | "archived" | "all";

/** Query params the list endpoint takes, nested exactly as the API expects. */
export type ProjectListParams = {
  pagination?: { page?: number; limit?: number };
  sort?: Partial<ProjectSortDto>;
  q?: string;
  status?: ProjectStatusFilter;
};

/** What the list screen keeps in the URL-free local filter state. */
export type ProjectListFilters = {
  q: string;
  status: ProjectStatusFilter;
  page: number;
};
