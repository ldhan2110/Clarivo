"use client";

import { useEffect } from "react";
import { Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Brand } from "./brand";
import { NavGroups } from "./nav-groups";
import { NavUser } from "./nav-user";
import { useSidebar } from "./sidebar-context";

/**
 * Below md the sidebar is gone; this top bar's menu button opens the same
 * NAV_ITEMS as a drawer. No bottom tab bar — deliberately cut.
 */
export function MobileNav() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Visibility is CSS (no hydration flash), but a drawer left open while the
  // viewport grows past md would float over the desktop layout.
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile, setMobileOpen]);

  return (
    <>
      <div className="flex h-[54px] shrink-0 items-center gap-2.5 px-3.5 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation"
            data-testid="mobile-nav-trigger"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-[19px]" />
          </Button>

          <SheetContent
            side="left"
            data-testid="mobile-drawer"
            className="inset-y-3 left-3 w-[268px] rounded-[18px] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl"
          >
            <div className="flex h-[60px] shrink-0 items-center px-3.5">
              <SheetTitle asChild>
                <span>
                  <Brand />
                </span>
              </SheetTitle>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close navigation"
                  className="ml-auto text-muted-foreground"
                >
                  <X />
                </Button>
              </SheetClose>
            </div>

            <NavGroups onNavigate={() => setMobileOpen(false)} />

            <div className="shrink-0 p-2.5">
              <Separator className="mb-2.5 bg-sidebar-border" />
              <NavUser />
            </div>
          </SheetContent>
        </Sheet>

        <Brand />

        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="ml-auto text-muted-foreground">
          <Bell className="size-[17px]" />
        </Button>
      </div>
    </>
  );
}
