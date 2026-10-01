/** Tone vocabulary shared by the toast and the confirm dialog. */
export type ConfirmTone = "confirm" | "success" | "info" | "warning" | "error";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Drives the icon, and whether confirm is `destructive` ("error" only). */
  tone?: ConfirmTone;
  /** Awaited — the dialog stays open and disabled until it settles. */
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};
