"use client";

import { createContext, useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ToneIcon } from "@/components/ui/tone-icon";
import { CONFIRM_ERROR_TOAST_ID } from "@/constants/confirm";
import { apiErrorMessage } from "@/lib/api-error";
import type { ConfirmOptions } from "@/types/confirm";

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * One AlertDialog for the whole app, driven imperatively. Call sites get no JSX
 * and no local open state — see `hooks/use-confirm.ts`.
 *
 * The dialog owns the pending state: while an awaited `onConfirm` is unsettled it
 * stays open with both buttons disabled and Esc/overlay blocked. Closing early
 * would let the user dismiss mid-work and believe the action was cancelled.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [pending, setPending] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (next) =>
      new Promise<boolean>((resolve) => {
        // A second call replaces the open dialog: the first promise resolves
        // false, but its onCancel does NOT fire — the user didn't cancel, the
        // app moved on. No queue.
        settle(false);
        resolveRef.current = resolve;
        setPending(false);
        setOptions(next);
      }),
    [settle],
  );

  const close = useCallback(() => {
    setOptions(null);
    setPending(false);
  }, []);

  const cancel = useCallback(() => {
    if (pending) return;
    options?.onCancel?.();
    settle(false);
    close();
  }, [pending, options, settle, close]);

  const accept = useCallback(async () => {
    if (pending) return;
    const run = options?.onConfirm;
    if (!run) {
      settle(true);
      close();
      return;
    }
    setPending(true);
    try {
      await run();
      settle(true);
      close();
    } catch (error) {
      settle(false);
      close();
      toast.error(apiErrorMessage(error), { id: CONFIRM_ERROR_TOAST_ID });
    }
  }, [pending, options, settle, close]);

  const tone = options?.tone ?? "confirm";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AlertDialog
        open={options !== null}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
      >
        {options && (
          <AlertDialogContent
            // Pending guard: without it the user dismisses mid-delete and
            // believes the action was cancelled. The overlay needs no equivalent
            // handler — Radix omits `onPointerDownOutside`/`onInteractOutside`
            // from AlertDialogContent on purpose, so an outside click never
            // dismisses it, pending or not.
            onEscapeKeyDown={(e) => {
              if (pending) e.preventDefault();
            }}
          >
            <div className="grid grid-cols-[28px_1fr] items-start gap-[14px]">
              <ToneIcon tone={tone} size={28} className="-mt-px" />
              <div className="min-w-0">
                <AlertDialogTitle>{options.title}</AlertDialogTitle>
                {options.description && (
                  <AlertDialogDescription>{options.description}</AlertDialogDescription>
                )}
              </div>
            </div>

            <div className="mt-[22px] flex justify-end gap-2">
              <AlertDialogCancel asChild>
                <Button variant="outline" disabled={pending}>
                  {options.cancelLabel ?? "Cancel"}
                </Button>
              </AlertDialogCancel>
              {/* Not AlertDialogAction: that closes the dialog on click, which
                  would discard the pending state. */}
              <Button
                autoFocus
                variant={tone === "error" ? "destructive" : "default"}
                disabled={pending}
                onClick={accept}
              >
                {/* The spinner carries the pending state — the label never changes,
                    so there is no pendingLabel to pass or translate. */}
                {pending && <Loader2 className="size-[15px] animate-spin" />}
                {options.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
