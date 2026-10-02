"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Globe, Loader2, Plus, RefreshCw, Search, Upload, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ProjectNotFound } from "@/components/projects/project-not-found";
import { SummaryView } from "@/components/context/summary-view";
import { ResearchDialog } from "@/components/context/research-dialog";
import {
  useEditSummary,
  useProcessAll,
  useProjectContext,
  useRegenerateSummary,
  useUploadDocument,
} from "@/hooks/use-context";
import { useConfirm } from "@/hooks/use-confirm";
import type { ContextDto, SourceDto } from "@/types/api";

const ACCEPT = ".pdf,.docx,.txt,.md";

export default function ContextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isPending, isError } = useProjectContext(id);

  if (isError) return <ProjectNotFound />;
  if (isPending) return <ContextSkeleton />;
  return <Context projectId={id} context={data} />;
}

function Context({ projectId, context }: { projectId: string; context: ContextDto }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(context.summaryMd);
  const [researchOpen, setResearchOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const upload = useUploadDocument(projectId);
  const process = useProcessAll(projectId);
  const edit = useEditSummary(projectId);
  const regen = useRegenerateSummary(projectId);

  const unprocessed = context.sources.filter((s) => s.status === "new").length;
  const docs = context.sources.filter((s) => s.sourceType === "doc");
  const webs = context.sources.filter((s) => s.sourceType === "web");
  const hasSummary = context.summaryMd.trim().length > 0;

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) await upload.mutateAsync(file);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onRegenerate = async () => {
    if (context.edited) {
      const ok = await confirm({
        title: "Regenerate the summary?",
        description: "You edited this summary by hand. Regenerating replaces it with a fresh AI version.",
        confirmLabel: "Regenerate",
        tone: "warning",
      });
      if (!ok) return;
    }
    await regen.mutateAsync(context.edited);
  };

  const onSaveEdit = async () => {
    await edit.mutateAsync(draft);
    setEditing(false);
  };

  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0">
      <div className="hidden h-[58px] items-center gap-1.5 text-sm md:flex">
        <Link href={`/projects/${projectId}`} className="text-muted-foreground hover:text-foreground">
          Overview
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">Context</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            Context
            <Badge variant="secondary">
              {context.sources.length} source{context.sources.length === 1 ? "" : "s"}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One summary of everything Clarivo found — from your documents and the web.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setResearchOpen(true)}>
            <Search className="size-4" /> Research customer
          </Button>
          {hasSummary && !editing && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft(context.summaryMd);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
          {unprocessed > 0 ? (
            <Button onClick={() => process.mutate()} disabled={process.isPending}>
              {process.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Process all ({unprocessed})
            </Button>
          ) : (
            hasSummary && (
              <Button onClick={onRegenerate} disabled={regen.isPending}>
                {regen.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Regenerate
              </Button>
            )
          )}
        </div>
      </div>

      <Tiles context={context} />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[15px]">Project knowledge · summary.md</CardTitle>
            {context.edited && <Badge variant="outline">edited</Badge>}
          </CardHeader>
          <CardContent>
            {context.processing ? (
              <Processing />
            ) : editing ? (
              <div className="space-y-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[360px] font-mono text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={onSaveEdit} disabled={edit.isPending}>
                    {edit.isPending && <Loader2 className="size-4 animate-spin" />} Save
                  </Button>
                </div>
              </div>
            ) : hasSummary ? (
              <SummaryView markdown={context.summaryMd} />
            ) : (
              <Empty onPick={() => fileInput.current?.click()} unprocessed={unprocessed} onProcess={() => process.mutate()} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[15px]">Sources</CardTitle>
            <Badge variant="secondary">{context.sources.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {docs.length > 0 && (
              <SourceGroup label={`Documents · ${docs.length}`} sources={docs} />
            )}
            {webs.length > 0 && <SourceGroup label={`Web · ${webs.length}`} sources={webs} />}
            {context.sources.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No sources yet.</p>
            )}
            {unprocessed > 0 && (
              <Button className="w-full" onClick={() => process.mutate()} disabled={process.isPending}>
                <Zap className="size-4" /> Process all ({unprocessed})
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add documents
            </Button>
          </CardContent>
        </Card>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      <ResearchDialog projectId={projectId} open={researchOpen} onOpenChange={setResearchOpen} />
    </div>
  );
}

function Tiles({ context }: { context: ContextDto }) {
  const pct = Math.round((context.coverage.covered / context.coverage.total) * 100);
  const diagrams = (context.summaryMd.match(/```mermaid/g) ?? []).length;
  return (
    <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile k="Sources" v={String(context.sources.length)} d={`${context.sources.filter((s) => s.sourceType === "web").length} web`} />
      <Tile k="Sections covered" v={`${context.coverage.covered} / ${context.coverage.total}`} d="across 9 sections" />
      <Tile k="Diagrams" v={String(diagrams)} d="in the summary" />
      <Card>
        <CardContent className="flex items-center gap-3.5 py-4">
          <div
            className="grid size-[58px] shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--secondary) 0)` }}
          >
            <div className="grid size-[42px] place-items-center rounded-full bg-card text-sm font-semibold">
              {pct}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Coverage</div>
            <div className="text-xs text-muted-foreground">of 9 sections</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{k}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{v}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{d}</div>
      </CardContent>
    </Card>
  );
}

function SourceGroup({ label, sources }: { label: string; sources: SourceDto[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-2">
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2.5 rounded-md border border-border p-2.5"
          >
            {s.sourceType === "doc" ? (
              <FileText className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Globe className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{s.title}</div>
              {s.status === "failed" && s.failureReason && (
                <div className="truncate text-xs text-destructive">{s.failureReason}</div>
              )}
            </div>
            <StatusTag status={s.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: SourceDto["status"] }) {
  const variant =
    status === "processed" ? "secondary" : status === "failed" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className="shrink-0 text-[11px]">
      {status}
    </Badge>
  );
}

function Processing() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
      <Loader2 className="size-6 animate-spin text-primary" />
      <div className="text-sm font-medium">Summarizing sources…</div>
      <p className="text-xs text-muted-foreground">This runs in the background — you can leave the page.</p>
    </div>
  );
}

function Empty({
  onPick,
  unprocessed,
  onProcess,
}: {
  onPick: () => void;
  unprocessed: number;
  onProcess: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
      <Upload className="size-6 text-primary" />
      <div className="text-sm font-medium">
        {unprocessed > 0 ? `${unprocessed} source(s) ready to process.` : "No knowledge yet."}
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        Upload documents or research the customer, then process everything into one summary with
        sections and diagrams.
      </p>
      {unprocessed > 0 ? (
        <Button onClick={onProcess}>
          <Zap className="size-4" /> Process all ({unprocessed})
        </Button>
      ) : (
        <Button onClick={onPick}>
          <Plus className="size-4" /> Add documents
        </Button>
      )}
    </div>
  );
}

function ContextSkeleton() {
  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5">
      <Skeleton className="mb-4 h-8 w-40" />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
