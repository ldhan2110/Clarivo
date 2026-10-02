"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acceptProposal, listProposals, rejectProposal } from "@/services/context";
import type { ResolveConflictDto } from "@/types/api";

export function proposalsKey(projectId: string) {
  return ["context", projectId, "proposals"] as const;
}

export function useProposals(projectId: string) {
  return useQuery({
    queryKey: proposalsKey(projectId),
    queryFn: () => listProposals(projectId),
    enabled: Boolean(projectId),
  });
}

/** Resolving a proposal changes the page as well as the queue, so both go. */
function useResolve(projectId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: proposalsKey(projectId) });
    void client.invalidateQueries({ queryKey: ["context", projectId, "knowledge"] });
  };
}

/** No local onError — the global MutationCache toast owns these failures. */
export function useAcceptProposal(projectId: string) {
  const invalidate = useResolve(projectId);
  return useMutation({
    mutationFn: ({ blockId, body }: { blockId: string; body?: ResolveConflictDto }) =>
      acceptProposal(projectId, blockId, body),
    onSuccess: invalidate,
  });
}

export function useRejectProposal(projectId: string) {
  const invalidate = useResolve(projectId);
  return useMutation({
    mutationFn: (blockId: string) => rejectProposal(projectId, blockId),
    onSuccess: invalidate,
  });
}
