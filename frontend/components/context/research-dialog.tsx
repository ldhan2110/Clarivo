"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe, Loader2, Search } from "lucide-react";
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
import { useAcceptResearch, useResearchCustomer } from "@/hooks/use-context";
import type { ResearchDraftDto } from "@/types/api";
import { SummaryView } from "./summary-view";

const schema = z
  .object({
    companyName: z.string().max(255).optional(),
    url: z.string().url("Enter a valid URL").max(2048).optional().or(z.literal("")),
    building: z.string().max(500).optional(),
  })
  .refine((v) => Boolean(v.companyName?.trim()) || Boolean(v.url?.trim()), {
    message: "Enter a company name or a URL",
    path: ["companyName"],
  });

type FormValues = z.infer<typeof schema>;

export function ResearchDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<ResearchDraftDto | null>(null);
  const research = useResearchCustomer(projectId);
  const accept = useAcceptResearch(projectId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const close = () => {
    setDraft(null);
    reset();
    onOpenChange(false);
  };

  const onSearch = handleSubmit(async (values) => {
    const result = await research.mutateAsync({
      companyName: values.companyName?.trim() || undefined,
      url: values.url?.trim() || undefined,
      building: values.building?.trim() || undefined,
    });
    setDraft(result);
  });

  const onAdd = async () => {
    if (!draft) return;
    await accept.mutateAsync(draft.pages);
    close();
  };

  const busy = isSubmitting || research.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl">
        {!draft ? (
          <form onSubmit={onSearch}>
            <DialogHeader>
              <DialogTitle>Research customer</DialogTitle>
              <DialogDescription>
                Clarivo searches the web, then folds what it finds into the summary.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company name</Label>
                <Input id="companyName" placeholder="e.g. Sambu Vina" {...register("companyName")} />
                {errors.companyName && (
                  <p className="text-xs text-destructive">{errors.companyName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">Company website</Label>
                <Input id="url" placeholder="https://example.com" {...register("url")} />
                {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="building">What are they building? (optional)</Label>
                <Input
                  id="building"
                  placeholder="warehouse dispatch system"
                  {...register("building")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Search the web
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Found {draft.pages.length} page(s)</DialogTitle>
              <DialogDescription>Review, then add to the summary.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto py-2">
              {draft.pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing found. Try a different name or URL.
                </p>
              ) : (
                <>
                  <SummaryView markdown={draft.findings_md} />
                  <div className="space-y-1.5 pt-2">
                    {draft.pages.map((p) => (
                      <a
                        key={p.url}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-primary hover:bg-muted"
                      >
                        <Globe className="size-3.5 shrink-0" />
                        <span className="truncate">{p.url}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Discard
              </Button>
              <Button type="button" onClick={onAdd} disabled={accept.isPending || draft.pages.length === 0}>
                {accept.isPending && <Loader2 className="size-4 animate-spin" />}
                Add to summary
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
