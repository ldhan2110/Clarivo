"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { login, logout } from "@/services/auth";
import { useAuthStore } from "@/stores/auth";

export const GENERIC_AUTH_ERROR = "Incorrect email or password.";

/** 401 is deliberately indistinguishable between unknown email and bad password. */
export function authErrorMessage(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401
    ? GENERIC_AUTH_ERROR
    : "Something went wrong. Please try again.";
}

/** Login returns the UserDto, so the store is filled without a second request. */
export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: login,
    onSuccess: setUser,
    // Not dead code: the login form renders the 401 inline via errors.root, and
    // defining onError at all stands the global MutationCache toast down
    // (components/provider/query-provider.tsx). Deleting this double-reports.
    onError: () => {},
  });
}

export function useLogout() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: logout,
    // Not dead code: same stand-down as useLogin. The cookie is gone either way
    // and the user is already being redirected, so an error toast is noise.
    onError: () => {},
    // cookie is gone either way — never leave a stale user on screen
    onSettled: () => {
      clear();
      router.replace("/login");
      router.refresh();
    },
  });
}

/**
 * Bounces an already-signed-in visitor off /login. middleware.ts guards the other
 * direction (no cookie → /login) before a page is ever rendered.
 */
export function useRedirectIfAuthenticated(to = "/") {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace(to);
    router.refresh();
  }, [status, router, to]);
}
