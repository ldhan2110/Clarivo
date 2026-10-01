"use client";

import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/services/projects";
import type { ProjectListParams } from "@/types/project";

/** Key shape: ['projects', params]. A mutation that changes a row's list
 *  appearance invalidates ['projects'] wholesale rather than guessing params. */
export function projectsKey(params: ProjectListParams) {
  return ["projects", params] as const;
}

export function useProjects(params: ProjectListParams) {
  return useQuery({
    queryKey: projectsKey(params),
    queryFn: () => listProjects(params),
  });
}
