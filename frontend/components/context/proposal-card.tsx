"use client";

import { Download, FileText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentDownloadUrl } from "@/services/context";
import { cn } from "@/lib/utils";
import { SECTION_LABELS } from "@/types/context";
import type { ProposalItemDto, ResolveConflictDto } from "@/types/api";

/** 3px left rule per kind, exactly as the mockup has it. */
const RULE: Record<ProposalItemDto["kind"], string> = {
  add: "border-l-success",
  update: "border-l-chart-2",
  conflict: "border-l-warning",
};

const HEADING: Record<ProposalItemDto["kind"], string> = {
  add: "New block",
  update: "Update",
  conflict: "Conflict",
};

export function ProposalCard({
  proposal,
  busy,
  onAccept,
  onReject,
  onWriteOwn,
}: {
  proposal: ProposalItemDto;
  busy: boolean;
  onAccept: (body?: ResolveConflictDto) => void;
  onReject: () => void;
  onWriteOwn: () => void;
}) {
  const conflict = proposal.kind === "conflict";

  return (
    <article
      data-testid="proposal-card"
      data-kind={proposal.kind}
      className={cn(
        "border-l-[3px] border-t border-r border-b border-border bg-card p-3.5",
        RULE[proposal.kind],
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          {conflict && <TriangleAlert className="size-3.5 text-warning" />}
          {HEADING[proposal.kind]}
        </span>
        <Badge variant="outline">{SECTION_LABELS[proposal.section]}</Badge>
        <Badge variant="outline">{proposal.confidence}</Badge>

        {!conflict && (
          <span className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={busy} onClick={onReject}>
              Reject
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onAccept()}>
              Accept
            </Button>
          </span>
        )}
      </div>

      {proposal.kind === "update" && proposal.target ? (
        <div className="grid gap-1.5">
          <p className="rounded-[9px] bg-secondary px-3 py-2 text-sm text-muted-foreground line-through">
            {proposal.target.statement}
          </p>
          <p className="px-1 text-center text-xs text-muted-foreground">↓ replaced by</p>
          <p className="rounded-[9px] border border-border px-3 py-2 text-sm leading-6">
            {proposal.statement}
          </p>
        </div>
      ) : conflict && proposal.target ? (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-[9px] border border-border p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">On the page now</p>
            <p className="text-sm leading-6">{proposal.target.statement}</p>
          </div>
          <div className="rounded-[9px] border border-warning/35 bg-warning/10 p-3">
            <p className="mb-1 text-xs font-medium text-warning">Proposed</p>
            <p className="text-sm leading-6">{proposal.statement}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-6">{proposal.statement}</p>
      )}

      {proposal.refs.map((ref) => (
        <div key={ref.id} className="mt-2.5">
          {/* The verbatim quote is what makes a statement checkable. A null
              locator means a DERIVED block (the brief, a diagram) citing a
              whole document — there is no span, so there is no quote to pull. */}
          {ref.locator && (
            <blockquote className="border-l-2 border-border pl-2.5 text-xs text-muted-foreground italic">
              “{ref.quote}”
            </blockquote>
          )}
          <Badge variant="outline" className="mt-1.5" asChild>
            <a href={documentDownloadUrl(ref.fileId)} data-testid="citation-chip">
              <FileText className="size-3" />
              {ref.title}
              {ref.locator ? ` ${ref.locator}` : ""}
              <Download className="size-3" />
            </a>
          </Badge>
        </div>
      ))}

      {conflict && (
        /* Clarivo never picks a side. Whichever loses is kept with its source. */
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onAccept({ resolution: "keep_existing" })}
          >
            Keep existing
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onWriteOwn}>
            Write my own
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onAccept({ resolution: "use_new" })}>
            Use new
          </Button>
        </div>
      )}
    </article>
  );
}
