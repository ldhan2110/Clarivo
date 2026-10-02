"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight, Settings, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectNotFound } from "@/components/projects/project-not-found";
import { confirmRestore } from "@/constants/confirm";
import { CURRENT_STAGE, PROJECT_STAGES, projectStages } from "@/constants/project-stages";
import { useConfirm } from "@/hooks/use-confirm";
import { useContextDocuments } from "@/hooks/use-context-documents";
import { useProject, useRestoreProject } from "@/hooks/use-project";
import { formatDay, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectDto } from "@/types/api";

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isPending, isError } = useProject(id);

  // A malformed uuid is a 400 from ParseUUIDPipe and a missing-or-not-mine
  // project is a 404. To a user those are one situation, so both render here.
  if (isError) return <ProjectNotFound />;
  if (isPending) return <OverviewSkeleton />;

  return <Overview project={data} />;
}

function Overview({ project }: { project: ProjectDto }) {
  const confirm = useConfirm();
  const restore = useRestoreProject(project.id);
  // Stage 1 reads the real document count; the other three stay honest zeros.
  const documents = useContextDocuments(project.id);
  const stages = projectStages(documents.data?.length ?? 0);
  const archived = project.status === "archived";
  const isOwner = project.viewerRole === "owner";

  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0">
      <div className="hidden h-[58px] items-center gap-1.5 text-sm md:flex">
        <Link href="/projects" className="text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">{project.code}</span>
      </div>

      {archived && (
        <div
          data-testid="archived-ribbon"
          className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[12px] border border-warning/35 bg-warning/10 px-3.5 py-2.5"
        >
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <span className="text-xs text-foreground">
            This project is archived and read-only. Nothing has been deleted.
          </span>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() =>
                confirm({
                  ...confirmRestore(project.name),
                  onConfirm: async () => {
                    await restore.mutateAsync();
                    toast.success("Project restored");
                  },
                })
              }
            >
              Restore
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1
            className={cn(
              "flex flex-wrap items-center gap-2.5 text-xl font-bold tracking-tight md:text-[22px]",
              archived && "text-muted-foreground",
            )}
          >
            {project.name}
            <Badge variant="outline">{archived ? "Archived" : "Active"}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.code} · {project.customerBu} · {project.domain} ·{" "}
            {project.memberCount} {project.memberCount === 1 ? "member" : "members"}
            <Badge variant="outline" className="ml-2 align-middle">
              {isOwner ? "Owner" : "Member"}
            </Badge>
          </p>
        </div>

        {isOwner && (
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link href={`/projects/${project.id}/settings`}>
              <Settings className="size-4" />
              Settings
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-5 mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-3.5">
        {stages.map((stage) => (
          <Card key={stage.tile} className="flex items-start gap-2.5 p-3.5 md:p-4">
            <div>
              <div className="text-[22px] leading-tight font-bold tracking-tight md:text-[26px]">
                {stage.count}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{stage.tile}</div>
            </div>
            <div className="ml-auto grid size-8.5 shrink-0 place-items-center rounded-[10px] bg-secondary text-muted-foreground">
              <stage.icon className="size-4" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1.6fr_1fr]">
        <Card data-testid="project-plan">
          <CardHeader>
            <CardTitle>Project plan</CardTitle>
            <span className="ml-auto text-xs text-muted-foreground">
              {archived
                ? `Stopped at stage ${CURRENT_STAGE}`
                : `Stage ${CURRENT_STAGE} of ${PROJECT_STAGES.length}`}
            </span>
          </CardHeader>
          <CardContent>
            <div className="mb-3.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", archived ? "bg-muted-foreground" : "bg-primary")}
                style={{ width: `${(CURRENT_STAGE / PROJECT_STAGES.length) * 100}%` }}
              />
            </div>

            {stages.map((stage, i) => (
              <div
                key={stage.label}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  i > 0 && "border-t border-border",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    i + 1 === CURRENT_STAGE && !archived
                      ? "bg-primary/12 text-primary"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 text-sm">{stage.label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {stage.detail}
                </span>
                {stage.soon && (
                  <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                    Soon
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="project-summary">
          <CardHeader>
            <CardTitle>Project summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {project.objective || "No objective recorded yet."}
            </p>
            <Separator className="my-3.5" />
            <dl className="grid gap-2 text-xs">
              <SummaryRow label="Customer / BU" value={project.customerBu} />
              <SummaryRow label="Domain" value={project.domain} />
              <SummaryRow
                label="Timeline"
                value={
                  project.startsOn || project.endsOn
                    ? `${formatDay(project.startsOn)} – ${formatDay(project.endsOn)}`
                    : "Not set"
                }
              />
              <SummaryRow label="Members" value={String(project.memberCount)} />
              <SummaryRow label="Created" value={`by ${project.createdByName}`} />
              <SummaryRow label="Last updated" value={relativeTime(project.updatedAt)} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto text-right font-medium">{value}</dd>
    </div>
  );
}

/** Skeletons in the real tile and card shape, not a generic spinner. */
function OverviewSkeleton() {
  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0" data-testid="project-skeleton">
      <div className="hidden h-[58px] items-center md:flex">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />

      <div className="mt-5 mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex items-start gap-2.5 p-3.5 md:p-4">
            <div className="grid gap-1.5">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="ml-auto size-8.5 rounded-[10px]" />
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-1.5 w-full rounded-full" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="grid gap-2.5">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
