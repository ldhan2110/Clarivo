"use client";

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  archiveProject,
  createProject,
  getProject,
  restoreProject,
  updateProject,
} from "@/services/projects";
import type { CreateProjectDto, UpdateProjectDto } from "@/types/api";

export function projectKey(id: string) {
  return ["project", id] as const;
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKey(id),
    queryFn: () => getProject(id),
    enabled: Boolean(id),
  });
}

/**
 * onError is deliberately left undefined on every mutation whose failure
 * belongs in the global toast. The create/update forms render the code clash
 * and the date range as field errors instead, which is why those two call
 * sites pass their own handler — see query-provider.tsx for why defining one
 * at all stands the toast down.
 */
export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectDto) => createProject(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["projects"] }),
    // Not dead code: the dialog renders a duplicate code and a bad date range
    // as FIELD errors and anything else as a banner inside itself, so defining
    // onError at all is what stands the global MutationCache toast down.
    onError: () => {},
  });
}

export function useUpdateProject(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProjectDto) => updateProject(id, body),
    // Same stand-down as useCreateProject — the details form owns its errors.
    onError: () => {},
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKey(id) });
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useArchiveProject(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => archiveProject(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKey(id) });
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useRestoreProject(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => restoreProject(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKey(id) });
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
