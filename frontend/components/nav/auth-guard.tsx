"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { ShellSkeleton } from "./shell-skeleton";

/**
 * middleware.ts already bounces a request with no session cookie. This covers
 * the case it cannot: a cookie that is present but no longer valid, which only
 * /auth/me can tell us. "unknown" must never redirect — the cookie has not been
 * checked yet, and bouncing here would eject a signed-in user on every reload.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status === "unknown") return <ShellSkeleton />;
  if (status === "anonymous") return null;
  return children;
}
