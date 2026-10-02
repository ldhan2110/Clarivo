"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptResearch,
  editSummary,
  getContext,
  listSources,
  processAll,
  regenerateSummary,
  researchCustomer,
  uploadDocument,
} from "@/services/context";
import type { ResearchPageDto, ResearchRequestDto, SourceDto } from "@/types/api";

export function contextKey(id: string) {
  return ["context", id] as const;
}
export function sourcesKey(id: string) {
  return ["context", id, "sources"] as const;
}

const NON_TERMINAL = new Set(["new", "processing"]);

export function useProjectContext(id: string) {
  return useQuery({
    queryKey: contextKey(id),
    queryFn: () => getContext(id),
    enabled: Boolean(id),
    // Poll while anything is still processing; stop once every source is terminal.
    refetchInterval: (query) =>
      query.state.data?.sources.some((s) => NON_TERMINAL.has(s.status)) ? 2000 : false,
  });
}

export function useSources(id: string) {
  return useQuery({
    queryKey: sourcesKey(id),
    queryFn: () => listSources(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      (query.state.data as SourceDto[] | undefined)?.some((s) => NON_TERMINAL.has(s.status))
        ? 2000
        : false,
  });
}

function invalidateContext(client: ReturnType<typeof useQueryClient>, id: string) {
  void client.invalidateQueries({ queryKey: contextKey(id) });
}

export function useUploadDocument(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(id, file),
    onSuccess: () => invalidateContext(client, id),
  });
}

export function useResearchCustomer(id: string) {
  return useMutation({
    mutationFn: (body: ResearchRequestDto) => researchCustomer(id, body),
  });
}

export function useAcceptResearch(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (pages: ResearchPageDto[]) => acceptResearch(id, pages),
    onSuccess: () => invalidateContext(client, id),
  });
}

export function useProcessAll(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => processAll(id),
    onSuccess: () => invalidateContext(client, id),
  });
}

export function useEditSummary(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (summaryMd: string) => editSummary(id, summaryMd),
    onSuccess: () => invalidateContext(client, id),
  });
}

export function useRegenerateSummary(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean) => regenerateSummary(id, force),
    // The edited-guard 409 is surfaced by the caller as a confirm, so stand the toast down.
    onError: () => {},
    onSuccess: () => invalidateContext(client, id),
  });
}
