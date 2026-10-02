"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

/**
 * One short text answer. Used by rename and by "write my own" on a conflict.
 *
 * ponytail: deliberately not react-hook-form — one required field with one
 * rule does not need a resolver. Wire the form library in the moment this
 * grows a second field or a server-side field error.
 */
export function TextPromptDialog({
  open,
  title,
  description,
  label,
  initialValue,
  confirmLabel,
  multiline,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  multiline?: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Keyed so a new subject remounts the field with its own initial
            value — syncing it in an effect would cascade renders. */}
        <PromptForm
          key={`${open}:${initialValue}`}
          label={label}
          initialValue={initialValue}
          confirmLabel={confirmLabel}
          multiline={multiline}
          busy={busy}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function PromptForm({
  label,
  initialValue,
  confirmLabel,
  multiline,
  busy,
  onClose,
  onSubmit,
}: {
  label: string;
  initialValue: string;
  confirmLabel: string;
  multiline?: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const empty = value.trim().length === 0;

  return (
    <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!empty) onSubmit(value.trim());
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="text-prompt">{label}</Label>
            {multiline ? (
              <Textarea
                id="text-prompt"
                rows={4}
                value={value}
                disabled={busy}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <Input
                id="text-prompt"
                value={value}
                disabled={busy}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || empty}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
    </form>
  );
}
