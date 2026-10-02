"use client";

import { Download, FileText, Pencil, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentDownloadUrl } from "@/services/context";
import type { KnowledgeBlockDto } from "@/types/api";

/**
 * One block rendered as prose in a tinted panel, not as a bullet. It is
 * synthesised across every document at once, which is why it can state
 * something no single block does and why it cites documents rather than blocks.
 *
 * `Regenerate` proposes a replacement; it never overwrites. When documents have
 * been read since it was written, the stale ribbon says so by count rather than
 * silently refreshing — auto-regeneration would churn prose the BA just fixed.
 */
export function ProjectBrief({
  brief,
  staleCount,
  readOnly,
  isRegenerating,
  onRegenerate,
  onEdit,
}: {
  brief?: KnowledgeBlockDto;
  staleCount: number;
  readOnly: boolean;
  isRegenerating: boolean;
  onRegenerate: () => void;
  onEdit: (block: KnowledgeBlockDto) => void;
}) {
  return (
    <section data-testid="project-brief" className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Project brief
        </h3>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-xs"
            disabled={isRegenerating}
            onClick={onRegenerate}
          >
            <RefreshCw className={isRegenerating ? "size-3.5 animate-spin" : "size-3.5"} />
            Regenerate
          </Button>
        )}
      </div>

      {staleCount > 0 && (
        <div
          data-testid="brief-stale-ribbon"
          className="mb-2 flex items-center gap-2 rounded-[10px] border border-warning/35 bg-warning/10 px-3 py-2"
        >
          <TriangleAlert className="size-3.5 shrink-0 text-warning" />
          <span className="text-xs text-muted-foreground">
            {staleCount} {staleCount === 1 ? "document has" : "documents have"} been read since
            this brief was written. Regenerate to propose an updated one.
          </span>
        </div>
      )}

      {brief ? (
        <div className="rounded-[12px] border border-border bg-primary/5 p-4">
          <p className="text-sm leading-6 whitespace-pre-wrap">{brief.statement}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {brief.refs.map((ref) => (
              <Badge key={ref.id} variant="outline" asChild>
                <a href={documentDownloadUrl(ref.fileId)} data-testid="citation-chip">
                  <FileText className="size-3" />
                  {ref.title}
                  <Download className="size-3" />
                </a>
              </Badge>
            ))}
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto size-8 p-0"
                aria-label="Edit the project brief"
                onClick={() => onEdit(brief)}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            No brief yet. Regenerate builds one from every document read so far plus the
            project&apos;s own domain and objective — it proposes, it never overwrites.
          </p>
        </div>
      )}
    </section>
  );
}
