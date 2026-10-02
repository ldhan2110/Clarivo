"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveDocument,
  listDocuments,
  renameDocument,
  rereadDocument,
  uploadDocument,
} from "@/services/context";
import type { ProjectDocumentDto } from "@/types/api";

export function documentsKey(projectId: string) {
  return ["context", projectId, "documents"] as const;
}

/** Statuses the pipeline still owns. Anything else is settled. */
const NON_TERMINAL = ["pending", "parsing", "summarizing", "proposing"];

export function isProcessing(document: ProjectDocumentDto) {
  return NON_TERMINAL.includes(document.status);
}

/**
 * Polls only while something is actually being read, and stops the moment
 * nothing is. No SSE and no websocket — the status column is the progress.
 */
export function useContextDocuments(projectId: string) {
  return useQuery({
    queryKey: documentsKey(projectId),
    queryFn: () => listDocuments(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (query) =>
      query.state.data?.some(isProcessing) ? 2000 : false,
  });
}

/**
 * No local onError anywhere below: the global MutationCache toast from
 * add-feedback-layer owns these failures, and defining a handler here would
 * stand that toast down.
 */
export function useUploadDocument(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) =>
      uploadDocument(projectId, file, onProgress),
    onSuccess: () => client.invalidateQueries({ queryKey: documentsKey(projectId) }),
  });
}

export function useRenameDocument(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, title }: { documentId: string; title: string }) =>
      renameDocument(projectId, documentId, { title }),
    onSuccess: () => client.invalidateQueries({ queryKey: documentsKey(projectId) }),
  });
}

export function useRereadDocument(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => rereadDocument(projectId, documentId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: documentsKey(projectId) });
      void client.invalidateQueries({ queryKey: ["context", projectId, "proposals"] });
    },
  });
}

export function useArchiveDocument(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => archiveDocument(projectId, documentId),
    onSuccess: () => client.invalidateQueries({ queryKey: documentsKey(projectId) }),
  });
}
