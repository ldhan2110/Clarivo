"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { MemberStack } from "@/components/projects/member-stack";
import { NoProjectsMatch, NoProjectsYet } from "@/components/projects/project-empty";
import { confirmArchive, confirmRestore } from "@/constants/confirm";
import { useArchiveProject, useRestoreProject } from "@/hooks/use-project";
import { useProjects } from "@/hooks/use-projects";
import { useConfirm } from "@/hooks/use-confirm";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectSummaryDto } from "@/types/api";
import type { ProjectStatusFilter } from "@/types/project";

const PAGE_SIZE = 20;
const STATUSES: ProjectStatusFilter[] = ["active", "archived", "all"];
const STATUS_LABEL: Record<ProjectStatusFilter, string> = {
  active: "Active",
  archived: "Archived",
  all: "All",
};

export default function ProjectsPage() {
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<ProjectStatusFilter>("active");
  const [page, setPage] = useState(1);
  // Debounced so each keystroke does not become a request. The search drives
  // the query — never a client-side filter over one page of rows.
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, isPending, isError, refetch } = useProjects({
    q: query || undefined,
    status,
    pagination: { page, limit: PAGE_SIZE },
    sort: { sortBy: "updatedAt", sortOrder: "DESC" },
  });

  const filtered = Boolean(query) || status !== "active";
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  function clearFilters() {
    setTerm("");
    setStatus("active");
    setPage(1);
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-5 pt-4 pb-5 md:px-6.5 md:pt-0 md:pb-3">
      <div className="hidden h-[58px] items-center md:flex">
        <span className="text-sm font-semibold">Projects</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          className="ml-auto text-muted-foreground"
        >
          <Bell className="size-4" />
        </Button>
      </div>

      <h1 className="text-xl font-bold tracking-tight md:text-[22px]">Projects</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Every project you own or were added to.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          {/* bg-card here rather than in input.tsx: Input ships bg-transparent,
              which is correct everywhere it sits inside a card or dialog. This
              is the one input on the bare bg-muted shell, so it paints its own
              surface — the mockup's `background: var(--card)`. */}
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            data-testid="projects-search"
            className="pl-8.5 bg-card"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by status"
          data-testid="projects-status-filter"
          className="flex rounded-[10px] border border-border bg-card p-0.5"
        >
          {STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={cn(
                "rounded-[8px] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
                status === value && "bg-primary/12 font-semibold text-primary",
              )}
            >
              {STATUS_LABEL[value]}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <CreateProjectDialog domains={data?.items.map((p) => p.domain)} />
        </div>
      </div>

      {isError ? (
        <Card
          className="grid place-items-center gap-2.5 px-5 py-14 text-center"
          data-testid="projects-error"
        >
          <TriangleAlert className="size-9 text-destructive" strokeWidth={1.6} />
          <h2 className="text-sm font-semibold">Couldn&apos;t load your projects</h2>
          <p className="max-w-[36ch] text-xs text-muted-foreground">
            Something went wrong on our side. Try again in a moment.
          </p>
          <Button variant="outline" size="sm" className="mt-1" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <Card
          className={cn(
            "flex flex-col overflow-hidden p-0",
            !isPending && "min-h-0 flex-1",
          )}
        >
          {isPending ? (
            <ProjectRowsSkeleton />
          ) : data.items.length === 0 ? (
            <div className="grid flex-1 place-items-center">
              {filtered ? (
                <NoProjectsMatch term={query} onClear={clearFilters} />
              ) : (
                <NoProjectsYet action={<CreateProjectDialog />} />
              )}
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                <ProjectTable rows={data.items} />
              </div>
              <div className="flex shrink-0 items-center gap-2 border-t border-border px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground" data-testid="projects-range">
                  {firstRow}–{lastRow} of {total}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="px-1.5 text-xs font-semibold">
                    {page} / {lastPage}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next page"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function ProjectTable({ rows }: { rows: ProjectSummaryDto[] }) {
  return (
    <Table data-testid="projects-table">
      <TableHeader>
        <TableRow className="hover:bg-transparent [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-card">
          <TableHead className="uppercase tracking-[0.06em]">Project</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Customer / BU</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Domain</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Members</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Status</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Updated</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}
      </TableBody>
    </Table>
  );
}

function ProjectRow({ project }: { project: ProjectSummaryDto }) {
  const router = useRouter();
  const confirm = useConfirm();
  const archive = useArchiveProject(project.id);
  const restore = useRestoreProject(project.id);
  const archived = project.status === "archived";
  const isOwner = project.viewerRole === "owner";

  return (
    <TableRow
      data-testid="project-row"
      className="cursor-pointer"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <TableCell>
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-8.5 shrink-0 place-items-center rounded-[10px] text-primary-foreground",
              archived
                ? "bg-muted text-muted-foreground"
                : "bg-linear-140 from-chart-2 to-chart-1",
            )}
          >
            <Building2 className="size-4" />
          </span>
          <span className="min-w-0">
            <span className={cn("block truncate text-sm font-semibold", archived && "text-muted-foreground")}>
              {project.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{project.code}</span>
          </span>
        </span>
      </TableCell>
      <TableCell className="text-sm">{project.customerBu}</TableCell>
      <TableCell className="text-sm">{project.domain}</TableCell>
      <TableCell>
        <MemberStack names={project.memberNames} count={project.memberCount} />
      </TableCell>
      <TableCell>
        <Badge variant="outline">{archived ? "Archived" : "Active"}</Badge>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
        {relativeTime(project.updatedAt)}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${project.name}`}
              data-testid="project-row-menu"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          {/* No Delete item anywhere — archive is the only lifecycle action. */}
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => router.push(`/projects/${project.id}`)}>
              <ArrowUpRight className="size-4" />
              Open
            </DropdownMenuItem>
            {archived ? (
              <DropdownMenuItem
                disabled={!isOwner}
                onSelect={() =>
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
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={!isOwner}
                className="text-warning focus:text-warning"
                onSelect={() =>
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
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/** Skeletons in the real table shape, not a generic spinner block. */
function ProjectRowsSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-card">
          <TableHead className="uppercase tracking-[0.06em]">Project</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Customer / BU</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Domain</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Members</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Status</TableHead>
          <TableHead className="uppercase tracking-[0.06em]">Updated</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody data-testid="projects-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell>
              <span className="flex items-center gap-2.5">
                <Skeleton className="size-8.5 rounded-[10px]" />
                <span className="grid gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </span>
              </span>
            </TableCell>
            <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
            <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
            <TableCell><Skeleton className="h-7 w-16 rounded-[10px]" /></TableCell>
            <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-3 w-12" /></TableCell>
            <TableCell><Skeleton className="size-7 rounded-[8px]" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
