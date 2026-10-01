"use client";

import { Bell, Building2, CalendarDays, ChevronRight, FolderKanban, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { DATA_STATE, NEXT_MEETING, RECENT_PROJECTS, STATS } from "./dashboard-data";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const user = useUser();
  const empty = DATA_STATE === "empty";
  const errored = DATA_STATE === "error";

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

      {errored ? (
        <Card className="grid place-items-center gap-2.5 px-5 py-14 text-center" data-testid="dashboard-error">
          <TriangleAlert className="size-9 text-destructive" strokeWidth={1.6} />
          <h2 className="text-sm font-semibold">Couldn&apos;t load your dashboard</h2>
          <p className="max-w-[36ch] text-xs text-muted-foreground">
            Something went wrong on our side. Try again in a moment.
          </p>
          <Button variant="outline" size="sm" className="mt-1">
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-3.5">
            {STATS.map((stat) => (
              <Card key={stat.label} className="flex items-start gap-2.5 p-3.5 md:p-4">
                <div>
                  <div className="text-[22px] leading-tight font-bold tracking-tight md:text-[26px]">
                    {empty ? 0 : stat.value}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
                </div>
                <div className={cn("ml-auto grid size-8.5 shrink-0 place-items-center rounded-[10px]", stat.tint)}>
                  <stat.icon className="size-4" />
                </div>
              </Card>
            ))}
          </div>

          <div className="grid items-start gap-4 md:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Recent Projects</CardTitle>
                {!empty && (
                  <span className="ml-auto text-xs font-semibold text-primary">View all</span>
                )}
              </CardHeader>
              <CardContent className="px-2 pb-2">
                {empty ? (
                  <EmptyBlock
                    icon={<FolderKanban className="size-9 text-muted-foreground" strokeWidth={1.6} />}
                    title="No projects yet"
                    line="Projects land here once the Projects section ships."
                  />
                ) : (
                  RECENT_PROJECTS.map((p, i) => (
                    <div
                      key={p.name}
                      className={cn(
                        "flex items-center gap-3 rounded-[11px] p-2.5 transition-colors hover:bg-accent",
                        i > 0 && "border-t border-border",
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-linear-140 from-chart-2 to-chart-1 text-primary-foreground">
                        <Building2 className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Last meeting: {p.lastMeeting} · {p.requirements} requirements
                        </span>
                      </span>
                      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Meeting</CardTitle>
              </CardHeader>
              <CardContent>
                {empty ? (
                  <EmptyBlock
                    icon={<CalendarDays className="size-9 text-muted-foreground" strokeWidth={1.6} />}
                    title="Nothing scheduled"
                    line="Your next meeting will show up here."
                  />
                ) : (
                  <>
                    <div className="text-sm font-semibold tracking-tight">{NEXT_MEETING.title}</div>
                    <div className="mt-1.5 mb-2.5 text-xs text-muted-foreground">{NEXT_MEETING.when}</div>
                    <div className="mb-3.5 flex flex-wrap gap-1.5">
                      {NEXT_MEETING.pills.map((pill) => (
                        <Badge key={pill} variant="outline">
                          {pill}
                        </Badge>
                      ))}
                    </div>
                    <Button className="w-full">View details</Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyBlock({ icon, title, line }: { icon: React.ReactNode; title: string; line: string }) {
  return (
    <div className="grid place-items-center gap-2 px-5 py-11 text-center">
      {icon}
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="max-w-[36ch] text-xs text-muted-foreground">{line}</p>
    </div>
  );
}
