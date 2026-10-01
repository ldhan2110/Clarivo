"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SIDEBAR_COOKIE, SIDEBAR_COOKIE_MAX_AGE } from "@/constants/sidebar";

type SidebarState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}

// ponytail: a width flag, a cookie and one key handler — that is the whole
// sidebar state. Swap in shadcn's `sidebar` block if a ⌘K palette or
// rail-dragging is ever wanted; it is not worth ~1000 vendored lines for this.
export function SidebarProvider({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpenState] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo(
    () => ({ open, setOpen, toggle, mobileOpen, setMobileOpen }),
    [open, setOpen, toggle, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
