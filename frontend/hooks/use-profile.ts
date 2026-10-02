"use client";

import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { changePassword, patchProfile, uploadAvatar } from "@/services/users";
import { useAuthStore } from "@/stores/auth";

/** 401 here means the current password was wrong — shown inline, not as a toast. */
export function passwordErrorMessage(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401
    ? "Current password is incorrect."
    : "Something went wrong. Please try again.";
}

/** Name save returns the UserDto, so the store (and nav avatar/label) refreshes
 *  without a second request. Errors fall through to the global toast. */
export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: patchProfile,
    onSuccess: (user) => {
      setUser(user);
      toast.success("Profile updated");
    },
  });
}

/** Avatar persists on pick; the returned UserDto carries the new avatarFileId,
 *  so the nav avatar updates everywhere. Errors fall through to the global toast. */
export function useUploadAvatar() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (user) => {
      setUser(user);
      toast.success("Avatar updated");
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
    // Defining onError stands down the global MutationCache toast
    // (components/provider/query-provider.tsx) — the 401 renders inline in the
    // password section instead. Same mechanism as useLogin.
    onError: () => {},
    onSuccess: () => toast.success("Password updated"),
  });
}
