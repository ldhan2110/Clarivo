import { api } from "@/lib/api";
import type {
  CreateBlockDto,
  KnowledgeBlockDto,
  KnowledgePageDto,
  ProjectDocumentDto,
  ProposalGroupDto,
  RenameDocumentDto,
  ResolveConflictDto,
  UpdateBlockDto,
} from "@/types/api";

export async function listDocuments(projectId: string) {
  const { data } = await api.get<ProjectDocumentDto[]>(`/projects/${projectId}/documents`);
  return data;
}

/** Returns as soon as the row exists — the backend reads the document after. */
export async function uploadDocument(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const body = new FormData();
  body.append("file", file);

  const { data } = await api.post<ProjectDocumentDto>(
    `/projects/${projectId}/documents`,
    body,
    {
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );
  return data;
}

export async function renameDocument(
  projectId: string,
  documentId: string,
  body: RenameDocumentDto,
) {
  const { data } = await api.patch<ProjectDocumentDto>(
    `/projects/${projectId}/documents/${documentId}`,
    body,
  );
  return data;
}

export async function rereadDocument(projectId: string, documentId: string) {
  const { data } = await api.post<ProjectDocumentDto>(
    `/projects/${projectId}/documents/${documentId}/reread`,
  );
  return data;
}

export async function archiveDocument(projectId: string, documentId: string) {
  const { data } = await api.post<ProjectDocumentDto>(
    `/projects/${projectId}/documents/${documentId}/archive`,
  );
  return data;
}

export async function getKnowledge(projectId: string) {
  const { data } = await api.get<KnowledgePageDto>(`/projects/${projectId}/knowledge`);
  return data;
}

export async function createBlock(projectId: string, body: CreateBlockDto) {
  const { data } = await api.post<KnowledgeBlockDto>(
    `/projects/${projectId}/knowledge/blocks`,
    body,
  );
  return data;
}

export async function updateBlock(projectId: string, blockId: string, body: UpdateBlockDto) {
  const { data } = await api.patch<KnowledgeBlockDto>(
    `/projects/${projectId}/knowledge/blocks/${blockId}`,
    body,
  );
  return data;
}

export async function deleteBlock(projectId: string, blockId: string) {
  await api.delete(`/projects/${projectId}/knowledge/blocks/${blockId}`);
}

export async function regenerateBrief(projectId: string) {
  const { data } = await api.post(`/projects/${projectId}/knowledge/brief/regenerate`);
  return data;
}

export async function listProposals(projectId: string) {
  const { data } = await api.get<ProposalGroupDto[]>(
    `/projects/${projectId}/knowledge/proposals`,
  );
  return data;
}

export async function acceptProposal(
  projectId: string,
  blockId: string,
  body: ResolveConflictDto = {},
) {
  const { data } = await api.post(
    `/projects/${projectId}/knowledge/proposals/${blockId}/accept`,
    body,
  );
  return data;
}

export async function rejectProposal(projectId: string, blockId: string) {
  const { data } = await api.post(
    `/projects/${projectId}/knowledge/proposals/${blockId}/reject`,
  );
  return data;
}

/** Where a citation chip points. The one download path in the app. */
export function documentDownloadUrl(fileId: string) {
  return `${api.defaults.baseURL}/files/${fileId}`;
}
