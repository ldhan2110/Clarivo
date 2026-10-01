"use client";

import Link from "next/link";
import { Bell, Building2, ChevronRight, FolderKanban, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { NoProjectsYet } from "@/components/projects/project-empty";
import { SOON_STATS } from "@/constants/dashboard";
import { useProjects } from "@/hooks/use-projects";
import { relativeTime } from "@/lib/format";
import { useUser } from "@/stores/auth";
import { cn } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const user = useUser();
  // The existing list endpoint, not a second one: total comes off the envelope
  // and the five rows are the items. Archived projects never appear.
  const { data, isPending, isError, refetch } = useProjects({
    status: "active",
    pagination: { page: 1, limit: 5 },
    sort: { sortBy: "updatedAt", sortOrder: "DESC" },
  });

  const empty = !isPending && !isError && data.items.length === 0;

  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0">
      <div className="hidden h-[58px] items-center md:flex">
        <span className="text-sm font-semibold">Dashboard</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          className="relative ml-auto text-muted-foreground"
        >
          <Bell className="size-4" />
          <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
        </Button>
      </div>

      <h1 className="text-xl font-bold tracking-tight md:text-[22px]">
        {greeting(new Date().getHours())}
        {user ? `, ${user.name}` : ""} 👋
      </h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground md:mb-5.5">
        {empty
          ? "Nothing here yet — create your first project to get started."
          : "Here's what's happening with your projects."}
      </p>

      {isError ? (
        <Card className="grid place-items-center gap-2.5 px-5 py-14 text-center" data-testid="dashboard-error">
          <TriangleAlert className="size-9 text-destructive" strokeWidth={1.6} />
          <h2 className="text-sm font-semibold">Couldn&apos;t load your dashboard</h2>
          <p className="max-w-[36ch] text-xs text-muted-foreground">
            Something went wrong on our side. Try again in a moment.
          </p>
          <Button variant="outline" size="sm" className="mt-1" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-3.5">
            <Card className="flex items-start gap-2.5 p-3.5 md:p-4">
              <div>
                <div className="text-[22px] leading-tight font-bold tracking-tight md:text-[26px]">
                  {isPending ? <Skeleton className="h-6 w-8" /> : data.total}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">Total Projects</div>
              </div>
              <div className="ml-auto grid size-8.5 shrink-0 place-items-center rounded-[10px] bg-chart-1/14 text-chart-1">
                <FolderKanban className="size-4" />
              </div>
            </Card>

            {SOON_STATS.map((stat) => (
              <Card key={stat.label} className="flex items-start gap-2.5 p-3.5 md:p-4">
                <div>
                  <div className="text-[22px] leading-tight font-bold tracking-tight md:text-[26px]">
                    {stat.value}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {stat.label}
                    <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                      Soon
                    </Badge>
                  </div>
                </div>
                <div className={cn("ml-auto grid size-8.5 shrink-0 place-items-center rounded-[10px]", stat.tint)}>
                  <stat.icon className="size-4" />
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
              {!empty && (
                <Link href="/projects" className="ml-auto text-xs font-semibold text-primary">
                  View all →
                </Link>
              )}
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {isPending ? (
                <div className="grid gap-1.5 p-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-[11px]" />
                  ))}
                </div>
              ) : empty ? (
                <NoProjectsYet action={<CreateProjectDialog />} />
              ) : (
                data.items.map((project, i) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-[11px] p-2.5 transition-colors hover:bg-accent",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-linear-140 from-chart-2 to-chart-1 text-primary-foreground">
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{project.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {project.customerBu} · {project.domain} · {project.memberCount}{" "}
                        {project.memberCount === 1 ? "member" : "members"} ·{" "}
                        {relativeTime(project.updatedAt)}
                      </span>
                    </span>
                    <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
