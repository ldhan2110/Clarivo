import { api } from "@/lib/api";
import type {
  AddMemberDto,
  CreateProjectDto,
  ProjectDto,
  ProjectListDto,
  ProjectMemberDto,
  UpdateProjectDto,
} from "@/types/api";
import type { ProjectListParams } from "@/types/project";

export async function listProjects(params: ProjectListParams) {
  const { data } = await api.get<ProjectListDto>("/projects", { params });
  return data;
}

export async function getProject(id: string) {
  const { data } = await api.get<ProjectDto>(`/projects/${id}`);
  return data;
}

export async function createProject(body: CreateProjectDto) {
  const { data } = await api.post<ProjectDto>("/projects", body);
  return data;
}

export async function updateProject(id: string, body: UpdateProjectDto) {
  const { data } = await api.patch<ProjectDto>(`/projects/${id}`, body);
  return data;
}

export async function archiveProject(id: string) {
  const { data } = await api.post<ProjectDto>(`/projects/${id}/archive`);
  return data;
}

export async function restoreProject(id: string) {
  const { data } = await api.post<ProjectDto>(`/projects/${id}/restore`);
  return data;
}

export async function listMembers(id: string) {
  const { data } = await api.get<ProjectMemberDto[]>(`/projects/${id}/members`);
  return data;
}

export async function addMember(id: string, body: AddMemberDto) {
  const { data } = await api.post<ProjectMemberDto>(`/projects/${id}/members`, body);
  return data;
}

export async function removeMember(id: string, userId: string) {
  await api.delete(`/projects/${id}/members/${userId}`);
}
