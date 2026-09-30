import { api } from "@/lib/api";
import type { LoginDto, UserDto } from "@/types/api";

export async function login(body: LoginDto) {
  const { data } = await api.post<UserDto>("/auth/login", body);
  return data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function me() {
  const { data } = await api.get<UserDto>("/auth/me");
  return data;
}
