"use client";

import { Download, FileText, Pencil, Trash2, UserPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentDownloadUrl } from "@/services/context";
import { cn } from "@/lib/utils";
import { DiagramBlock, extractDiagram, statementWithoutDiagram } from "./diagram-block";
import type { KnowledgeBlockDto } from "@/types/api";

/** `--success` / `--warning` / `--muted-foreground`, never a raw hex. */
const CONFIDENCE_MARK: Record<KnowledgeBlockDto["confidence"], { glyph: string; tone: string }> = {
  stated: { glyph: "●", tone: "text-success" },
  implied: { glyph: "◐", tone: "text-warning" },
  uncertain: { glyph: "?", tone: "text-muted-foreground" },
};

export function KnowledgeBlock({
  block,
  readOnly,
  onEdit,
  onDelete,
}: {
  block: KnowledgeBlockDto;
  readOnly: boolean;
  onEdit: (block: KnowledgeBlockDto) => void;
  onDelete: (block: KnowledgeBlockDto) => void;
}) {
  const mark = CONFIDENCE_MARK[block.confidence];
  const diagram = extractDiagram(block.statement);
  const prose = diagram ? statementWithoutDiagram(block.statement) : block.statement;
  const human = block.origin === "human";

  return (
    <div
      data-testid="knowledge-block"
      data-origin={block.origin}
      className="group flex items-start gap-2.5 border-t border-border py-3 first:border-t-0"
    >
      <span className={cn("mt-0.5 shrink-0 text-sm leading-5", mark.tone)} aria-hidden>
        {mark.glyph}
      </span>

      <div className="min-w-0 flex-1">
        {prose && <p className="text-sm leading-6 whitespace-pre-wrap">{prose}</p>}
        {diagram && (
          <div className={cn(prose && "mt-2.5")}>
            <DiagramBlock source={diagram} />
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {block.refs.map((ref) => (
            <Badge key={ref.id} variant="outline" asChild>
              <a
                href={documentDownloadUrl(ref.fileId)}
                data-testid="citation-chip"
                title={ref.quote}
                className="hover:text-foreground"
              >
                <FileText className="size-3" />
                {ref.title}
                {ref.locator ? ` ${ref.locator}` : ""}
                <Download className="size-3" />
              </a>
            </Badge>
          ))}

          {human ? (
            <Badge variant="secondary" data-testid="human-attribution">
              <UserPen className="size-3" />
              written by {block.authorName ?? "a member"}
            </Badge>
          ) : (
            <Badge variant="outline">{block.confidence}</Badge>
          )}
        </div>
      </div>

      {!readOnly && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label="Edit this block"
            onClick={() => onEdit(block)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label="Delete this block"
            onClick={() => onDelete(block)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      )}
    </div>
  );
}
