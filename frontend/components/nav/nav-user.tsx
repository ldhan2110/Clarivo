"use client";

import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout } from "@/hooks/use-auth";
import { useUser } from "@/stores/auth";
import { cn } from "@/lib/utils";

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function NavUser({ collapsed = false }: { collapsed?: boolean }) {
  const user = useUser();
  const logout = useLogout();

  if (!user) return <NavUserSkeleton collapsed={collapsed} />;

  // ponytail: UserDto carries no role, so the mockup's "BA" is a constant.
  // Render user.role here the moment the backend adds one.
  const role = "BA";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="nav-user"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[10px] p-1.5 text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
            collapsed && "justify-center",
          )}
        >
          <Avatar className="bg-linear-140 from-chart-3 to-chart-1">
            <AvatarFallback className="bg-transparent text-primary-foreground">
              {initialsOf(user.name) || <User className="size-4" />}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="block text-xs text-muted-foreground">{role}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="pb-2">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User />
          Profile
          <Badge variant="outline" className="ml-auto text-[10px] tracking-wide uppercase">
            Soon
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          data-testid="sign-out"
          onSelect={() => logout.mutate()}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavUserSkeleton({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 p-1.5", collapsed && "justify-center")}>
      <Skeleton className="size-8 shrink-0 rounded-[10px]" />
      {!collapsed && (
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      )}
    </div>
  );
}
