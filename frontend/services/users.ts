import { api } from "@/lib/api";
import type { ChangePasswordDto, UpdateProfileDto, UserDto } from "@/types/api";

export async function patchProfile(body: UpdateProfileDto) {
  const { data } = await api.patch<UserDto>("/users/me", body);
  return data;
}

export async function changePassword(body: ChangePasswordDto) {
  await api.post("/users/me/password", body);
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  // Axios sets the multipart boundary itself when the body is FormData.
  const { data } = await api.patch<UserDto>("/users/me/avatar", form);
  return data;
}
