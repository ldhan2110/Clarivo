import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { AuthGuard } from "@/components/nav/auth-guard";
import { MobileNav } from "@/components/nav/mobile-nav";
import { SIDEBAR_COOKIE } from "@/components/nav/sidebar-cookie";
import { SidebarProvider } from "@/components/nav/sidebar-context";

/**
 * The shell around every authenticated route. Reading the collapse cookie on
 * the server is the whole point: the first paint is already the right width,
 * so a collapsed sidebar never flashes open.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const defaultOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={defaultOpen}>
        <TooltipProvider>
          <div
            data-sidebar-default={String(defaultOpen)}
            className="flex h-dvh w-full overflow-hidden bg-muted text-foreground"
          >
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileNav />
              <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </TooltipProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
