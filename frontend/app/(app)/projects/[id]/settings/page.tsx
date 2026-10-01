"use client";

import { use } from "react";
import Link from "next/link";
import { Archive, ChevronRight, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectDetailsCard } from "@/components/projects/project-details-card";
import { ProjectMembersCard } from "@/components/projects/project-members-card";
import { ProjectNotFound } from "@/components/projects/project-not-found";
import { confirmArchive, confirmRestore } from "@/constants/confirm";
import { useArchiveProject, useProject, useRestoreProject } from "@/hooks/use-project";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import type { ProjectDto } from "@/types/api";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isPending, isError } = useProject(id);

  if (isError) return <ProjectNotFound />;
  if (isPending) return <SettingsSkeleton />;
  // A member reaching this URL directly gets the same screen as a bad id. The
  // owner-only writes are enforced server-side regardless — this is only the
  // route-level presentation choice.
  if (data.viewerRole !== "owner") return <ProjectNotFound />;

  return <Settings project={data} />;
}

function Settings({ project }: { project: ProjectDto }) {
  const confirm = useConfirm();
  const archive = useArchiveProject(project.id);
  const restore = useRestoreProject(project.id);
  const archived = project.status === "archived";

  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0">
      <div className="hidden h-[58px] items-center gap-1.5 text-sm md:flex">
        <Link href="/projects" className="text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <Link
          href={`/projects/${project.id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {project.code}
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">Settings</span>
      </div>

      <div className="mx-auto max-w-[760px]">
        {archived && (
          <div
            data-testid="archived-ribbon"
            className="mb-4 flex items-center gap-2.5 rounded-[12px] border border-warning/35 bg-warning/10 px-3.5 py-2.5"
          >
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <span className="text-xs">
              This project is archived and read-only. Nothing has been deleted.
            </span>
          </div>
        )}

        <h1 className="text-xl font-bold tracking-tight md:text-[22px]">Project settings</h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Details, members and lifecycle for {project.code}.
        </p>

        <div className="grid gap-4">
          <ProjectDetailsCard project={project} disabled={archived} />
          <ProjectMembersCard project={project} disabled={archived} />

          <Card
            data-testid="danger-zone"
            className={cn(archived ? "border-primary/40" : "border-warning/40")}
          >
            <CardHeader>
              <CardTitle>{archived ? "Archived project" : "Danger zone"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {archived
                  ? "Restoring moves this project back into the active list and makes it editable again."
                  : "Archiving hides this project from the active list and makes it read-only. Nothing is deleted, and you can restore it at any time."}
              </p>
              {/* Archive is the only lifecycle action — there is no delete. */}
              {archived ? (
                <Button
                  variant="outline"
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
                  <RotateCcw className="size-4" />
                  Restore project
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="border-warning/50 text-warning hover:text-warning"
                  onClick={() =>
                    confirm({
                      ...confirmArchive(project.name),
                      onConfirm: async () => {
                        await archive.mutateAsync();
                        toast.success("Project archived");
                      },
                    })
                  }
                >
                  <Archive className="size-4" />
                  Archive project
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0">
      <div className="mx-auto grid max-w-[760px] gap-4">
        <Skeleton className="h-7 w-52" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {Array.from({ length: 3 }).map((__, j) => (
                <Skeleton key={j} className="h-9 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
