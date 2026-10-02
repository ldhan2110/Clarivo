"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBlock,
  deleteBlock,
  getKnowledge,
  regenerateBrief,
  updateBlock,
} from "@/services/context";
import type { CreateBlockDto, UpdateBlockDto } from "@/types/api";

export function knowledgeKey(projectId: string) {
  return ["context", projectId, "knowledge"] as const;
}

export function useKnowledge(projectId: string) {
  return useQuery({
    queryKey: knowledgeKey(projectId),
    queryFn: () => getKnowledge(projectId),
    enabled: Boolean(projectId),
  });
}

/** No local onError — the global MutationCache toast owns these failures. */
export function useCreateBlock(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBlockDto) => createBlock(projectId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey(projectId) }),
  });
}

export function useUpdateBlock(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, body }: { blockId: string; body: UpdateBlockDto }) =>
      updateBlock(projectId, blockId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey(projectId) }),
  });
}

export function useDeleteBlock(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => deleteBlock(projectId, blockId),
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey(projectId) }),
  });
}

/** Proposes a replacement brief; the live one stays until a human accepts. */
export function useRegenerateBrief(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateBrief(projectId),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["context", projectId, "proposals"] }),
  });
}
