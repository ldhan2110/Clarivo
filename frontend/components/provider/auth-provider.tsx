"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

/** Fills the auth store from the session cookie once, on first client render. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return children;
}
