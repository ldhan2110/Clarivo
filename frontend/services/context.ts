import { api } from "@/lib/api";
import type {
  ContextDto,
  ResearchDraftDto,
  ResearchPageDto,
  ResearchRequestDto,
  SourceDto,
} from "@/types/api";

export async function getContext(projectId: string) {
  const { data } = await api.get<ContextDto>(`/projects/${projectId}/context`);
  return data;
}

export async function listSources(projectId: string) {
  const { data } = await api.get<SourceDto[]>(`/projects/${projectId}/documents`);
  return data;
}

export async function uploadDocument(projectId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<SourceDto>(`/projects/${projectId}/documents`, form);
  return data;
}

export async function researchCustomer(projectId: string, body: ResearchRequestDto) {
  const { data } = await api.post<ResearchDraftDto>(`/projects/${projectId}/research`, body);
  return data;
}

export async function acceptResearch(projectId: string, pages: ResearchPageDto[]) {
  const { data } = await api.post<SourceDto[]>(`/projects/${projectId}/research/accept`, {
    pages,
  });
  return data;
}

export async function processAll(projectId: string) {
  const { data } = await api.post<{ started: boolean }>(`/projects/${projectId}/context/process`);
  return data;
}

export async function editSummary(projectId: string, summaryMd: string) {
  const { data } = await api.put<ContextDto>(`/projects/${projectId}/context/summary`, {
    summaryMd,
  });
  return data;
}

export async function regenerateSummary(projectId: string, force: boolean) {
  const { data } = await api.post<ContextDto>(`/projects/${projectId}/context/regenerate`, {
    force,
  });
  return data;
}
