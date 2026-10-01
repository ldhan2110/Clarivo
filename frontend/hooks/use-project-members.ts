"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMember, listMembers, removeMember } from "@/services/projects";
import { projectKey } from "@/hooks/use-project";

export function projectMembersKey(id: string) {
  return ["project", id, "members"] as const;
}

export function useProjectMembers(id: string) {
  return useQuery({
    queryKey: projectMembersKey(id),
    queryFn: () => listMembers(id),
    enabled: Boolean(id),
  });
}

/** memberCount lives on the project, so both keys are invalidated. */
function invalidate(client: ReturnType<typeof useQueryClient>, id: string) {
  void client.invalidateQueries({ queryKey: projectMembersKey(id) });
  void client.invalidateQueries({ queryKey: projectKey(id) });
  void client.invalidateQueries({ queryKey: ["projects"] });
}

/** onError defined at the call site: an unknown email and an existing member
 *  both render under the email input rather than as a toast. */
export function useAddMember(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => addMember(id, { email }),
    onSuccess: () => invalidate(client, id),
    // Stands the global toast down: an unknown email and an existing member
    // both render under the email input instead.
    onError: () => {},
  });
}

export function useRemoveMember(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(id, userId),
    onSuccess: () => invalidate(client, id),
  });
}
