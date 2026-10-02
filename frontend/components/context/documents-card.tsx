"use client";

import { Download, FileText, MoreHorizontal, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { documentDownloadUrl } from "@/services/context";
import { isProcessing } from "@/hooks/use-context-documents";
import { cn } from "@/lib/utils";
import { PIPELINE_STEPS, STATUS_LABELS } from "@/types/context";
import type { ProjectDocumentDto } from "@/types/api";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function DocumentsCard({
  documents,
  isPending,
  readOnly,
  onUpload,
  onRename,
  onReread,
  onArchive,
}: {
  documents: ProjectDocumentDto[];
  isPending: boolean;
  readOnly: boolean;
  onUpload: () => void;
  onRename: (document: ProjectDocumentDto) => void;
  onReread: (document: ProjectDocumentDto) => void;
  onArchive: (document: ProjectDocumentDto) => void;
}) {
  return (
    <Card data-testid="context-documents">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">{documents.length}</span>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Nothing uploaded yet. Clarivo reads each document once and proposes what it learned.
          </p>
        ) : (
          <div className="grid">
            {documents.map((document, index) => (
              <DocumentRow
                key={document.id}
                document={document}
                first={index === 0}
                readOnly={readOnly}
                onRename={onRename}
                onReread={onReread}
                onArchive={onArchive}
              />
            ))}
          </div>
        )}

        {!readOnly && (
          <>
            <Separator className="my-3.5" />
            <Button variant="outline" size="sm" className="w-full" onClick={onUpload}>
              <FileText className="size-4" />
              Add more documents
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentRow({
  document,
  first,
  readOnly,
  onRename,
  onReread,
  onArchive,
}: {
  document: ProjectDocumentDto;
  first: boolean;
  readOnly: boolean;
  onRename: (document: ProjectDocumentDto) => void;
  onReread: (document: ProjectDocumentDto) => void;
  onArchive: (document: ProjectDocumentDto) => void;
}) {
  const processing = isProcessing(document);
  const failed = document.status === "failed";

  return (
    <div
      data-testid="context-document-row"
      data-status={document.status}
      className={cn("flex items-start gap-2.5 py-2.5", !first && "border-t border-border")}
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-secondary text-muted-foreground">
        <FileText className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{document.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatSize(document.sizeBytes)} · {document.blockCount}{" "}
          {document.blockCount === 1 ? "block" : "blocks"}
        </span>

        {processing && <PipelinePips status={document.status} />}

        {failed && document.error && (
          <span className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span className="text-muted-foreground">{document.error}</span>
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <Badge variant={failed ? "destructive" : processing ? "secondary" : "outline"}>
          {processing && <RefreshCw className="size-3 animate-spin" />}
          {STATUS_LABELS[document.status]}
        </Badge>

        <Button variant="ghost" size="sm" className="size-8 p-0" asChild>
          <a
            href={documentDownloadUrl(document.fileId)}
            aria-label={`Download ${document.title}`}
            title={`Download ${document.title}`}
          >
            <Download className="size-4" />
          </a>
        </Button>

        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                aria-label={`Actions for ${document.title}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={documentDownloadUrl(document.fileId)}>Download original</a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRename(document)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onReread(document)}>Read again</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onArchive(document)}>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </div>
  );
}

/**
 * Four pips, one per pipeline step. ponytail: two spans per step, no progress
 * primitive exists in this repo and four states do not justify adding one.
 */
function PipelinePips({ status }: { status: ProjectDocumentDto["status"] }) {
  const reached = PIPELINE_STEPS.indexOf(status);

  return (
    <span className="mt-2 flex items-center gap-1" aria-hidden>
      {PIPELINE_STEPS.map((step, index) => (
        <span
          key={step}
          className={cn(
            "h-1 flex-1 rounded-full",
            index <= reached ? "bg-primary" : "bg-secondary",
          )}
        />
      ))}
    </span>
  );
}
