"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Mirrors backend MIME_EXTENSIONS. Anything else is refused in the browser,
 *  before a byte leaves the machine, so the user is told immediately. */
const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const ACCEPT_ATTR = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif";
const MAX_BYTES = 100 * 1024 * 1024;

type Queued = {
  file: File;
  /** Set when the browser refused it before upload. */
  rejected?: string;
  percent: number;
  done: boolean;
};

function classify(file: File): string | undefined {
  // .md often arrives with an empty or text/plain type; trust the extension too.
  const markdown = file.name.toLowerCase().endsWith(".md");
  if (!markdown && !ACCEPTED.has(file.type)) return "Not a supported type";
  if (file.size > MAX_BYTES) return "Larger than the 100 MB limit";
  return undefined;
}

export function UploadDialog({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<unknown>;
}) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const enqueue = (files: FileList | null) => {
    if (!files) return;
    setQueue((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        file,
        rejected: classify(file),
        percent: 0,
        done: false,
      })),
    ]);
  };

  const accepted = queue.filter((item) => !item.rejected && !item.done);

  const start = async () => {
    setUploading(true);
    try {
      for (const item of accepted) {
        await onUpload(item.file, (percent) =>
          setQueue((current) =>
            current.map((row) => (row.file === item.file ? { ...row, percent } : row)),
          ),
        );
        setQueue((current) =>
          current.map((row) => (row.file === item.file ? { ...row, done: true, percent: 100 } : row)),
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const close = () => {
    setQueue([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Upload context documents</DialogTitle>
          <DialogDescription>
            PDF, Word, Markdown or plain text. Clarivo reads each one once and proposes what it
            learned — nothing lands on the page until you accept it.
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="upload-dropzone"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            enqueue(event.dataTransfer.files);
          }}
          className={cn(
            "grid place-items-center gap-2 rounded-[12px] border border-dashed px-5 py-8 text-center transition-colors",
            dragging ? "border-primary bg-primary/8" : "border-border",
          )}
        >
          <Upload className="size-7 text-muted-foreground" strokeWidth={1.6} />
          <p className="text-sm font-medium">Drop files here</p>
          <p className="text-xs text-muted-foreground">Up to 100 MB each</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => input.current?.click()}
          >
            Choose files
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept={ACCEPT_ATTR}
            onChange={(event) => {
              enqueue(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {queue.length > 0 && (
          <div className="grid gap-1.5">
            {queue.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                data-testid={item.rejected ? "upload-rejected" : "upload-queued"}
                className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{item.file.name}</span>
                  {item.rejected ? (
                    <span className="flex items-center gap-1 text-xs text-warning">
                      <TriangleAlert className="size-3" />
                      {item.rejected}
                    </span>
                  ) : (
                    /* ponytail: two divs, not a progress primitive — this repo
                       has none and one bar does not justify adding one. */
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${item.percent}%` }}
                      />
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 shrink-0 p-0"
                  aria-label={`Remove ${item.file.name}`}
                  disabled={uploading}
                  onClick={() => setQueue((current) => current.filter((_, i) => i !== index))}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {/* Closing is safe: reading runs in the background. */}
            {uploading ? "Close — reading continues" : "Cancel"}
          </Button>
          <Button type="button" disabled={uploading || accepted.length === 0} onClick={start}>
            {uploading && <Loader2 className="size-4 animate-spin" />}
            Upload {accepted.length > 0 ? accepted.length : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
