"use client";

import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { extractDiagram, DiagramBlock } from "./diagram-block";
import { SectionSelect } from "./section-select";
import { blockSchema, EMPTY_BLOCK, type BlockFormValues } from "./block-schema";
import type { KnowledgeBlockDto, ProjectDocumentDto } from "@/types/api";

const CONFIDENCE: { value: BlockFormValues["confidence"]; label: string; meaning: string }[] = [
  { value: "stated", label: "Stated", meaning: "The document says it outright" },
  { value: "implied", label: "Implied", meaning: "You inferred it from what it says" },
  { value: "uncertain", label: "Uncertain", meaning: "The document is ambiguous here" },
];

/**
 * One dialog for add and edit — the fields are identical and two components
 * would drift. react-hook-form + zodResolver, schema beside the form, and
 * never watch(): React Compiler cannot memoize it and eslint fails with
 * react-hooks/incompatible-library.
 */
export function BlockFormDialog({
  open,
  block,
  documents,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Present means edit; absent means add. */
  block?: KnowledgeBlockDto;
  documents: ProjectDocumentDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: BlockFormValues) => Promise<void>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BlockFormValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: EMPTY_BLOCK,
  });

  const refs = useFieldArray({ control, name: "refs" });

  useEffect(() => {
    if (!open) return;
    reset(
      block
        ? {
            section: block.section,
            statement: block.statement,
            confidence: block.confidence,
            refs: block.refs.map((ref) => ({
              documentId: ref.documentId,
              locator: ref.locator ?? "",
              quote: ref.quote,
            })),
          }
        : EMPTY_BLOCK,
    );
  }, [open, block, reset]);

  const pending = isSubmitting || busy;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{block ? "Edit this block" : "Write a block"}</DialogTitle>
          <DialogDescription>
            One assertion per block. It lands on the page accepted, attributed to you.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await onSubmit(values);
            } catch (cause) {
              setError("root", { message: apiErrorMessage(cause) });
            }
          })}
        >
          {block && (
            <div className="flex items-start gap-2 rounded-[10px] border border-warning/35 bg-warning/10 px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                Saving marks this block as human-edited. After that no document can silently
                replace it — a later disagreement raises a conflict for you to resolve.
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="block-section">Section</Label>
            <Controller
              control={control}
              name="section"
              render={({ field }) => (
                <SectionSelect
                  id="block-section"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-statement">Statement</Label>
            <Controller
              control={control}
              name="statement"
              render={({ field }) => (
                <>
                  <Textarea
                    id="block-statement"
                    rows={5}
                    disabled={pending}
                    aria-invalid={Boolean(errors.statement)}
                    className={cn(extractDiagram(field.value) && "font-mono text-xs")}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  {/* A mermaid fence turns this into the diagram editor —
                      same dialog, monospace field, live preview. */}
                  {extractDiagram(field.value) && (
                    <div className="mt-1">
                      <p className="mb-1 text-xs text-muted-foreground">Preview</p>
                      <DiagramBlock source={extractDiagram(field.value)!} />
                    </div>
                  )}
                </>
              )}
            />
            {errors.statement && (
              <p className="text-xs text-destructive">{errors.statement.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Confidence</Label>
            <Controller
              control={control}
              name="confidence"
              render={({ field }) => (
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {CONFIDENCE.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={pending}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        "rounded-[10px] border px-3 py-2 text-left transition-colors",
                        field.value === option.value
                          ? "border-primary bg-primary/8"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      <span className="block text-xs font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {option.meaning}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Label>Citations</Label>
              <span className="text-xs text-muted-foreground">optional</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-7"
                disabled={pending || documents.length === 0}
                onClick={() => refs.append({ documentId: documents[0]?.id ?? "", locator: "", quote: "" })}
              >
                <Plus className="size-3.5" />
                Add citation
              </Button>
            </div>

            {refs.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                A block you wrote needs no citation — you are the source.
              </p>
            ) : (
              refs.fields.map((row, index) => (
                <div key={row.id} className="grid gap-1.5 rounded-[10px] border border-border p-2.5">
                  <div className="flex gap-1.5">
                    <Controller
                      control={control}
                      name={`refs.${index}.documentId`}
                      render={({ field }) => (
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          disabled={pending}
                          aria-label="Document"
                          className="border-input flex h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        >
                          {documents.map((document) => (
                            <option key={document.id} value={document.id}>
                              {document.title}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    <Input
                      placeholder="p.12"
                      aria-label="Locator"
                      className="w-28"
                      disabled={pending}
                      {...register(`refs.${index}.locator`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-9 shrink-0 p-0"
                      aria-label="Remove this citation"
                      disabled={pending}
                      onClick={() => refs.remove(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="The sentence this came from, copied verbatim"
                    aria-label="Quote"
                    disabled={pending}
                    {...register(`refs.${index}.quote`)}
                  />
                  {errors.refs?.[index]?.quote && (
                    <p className="text-xs text-destructive">{errors.refs[index]?.quote?.message}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {errors.root && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              {errors.root.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {block ? "Save changes" : "Add block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
