"use client";

import { create } from "zustand";
import { me } from "@/services/auth";
import type { UserDto } from "@/types/api";

/** "unknown" until /auth/me has answered once — guards must not redirect before that. */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

type AuthState = {
  user: UserDto | null;
  status: AuthStatus;
  setUser: (user: UserDto) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "unknown",

  setUser: (user) => set({ user, status: "authenticated" }),
  clear: () => set({ user: null, status: "anonymous" }),

  hydrate: async () => {
    // ponytail: already answered → skip. The cookie can't change under us without
    // a login or logout, and both write the store themselves.
    if (get().status !== "unknown") return;
    try {
      set({ user: await me(), status: "authenticated" });
    } catch {
      set({ user: null, status: "anonymous" });
    }
  },
}));

export const useUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.status === "authenticated");
