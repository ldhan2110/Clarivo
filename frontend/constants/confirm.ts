import type { ConfirmOptions } from "@/types/confirm";

/** Toast id for a rejected `onConfirm`. Fixed so the second toast replaces the
 *  first rather than stacking on an error the MutationCache already reported. */
export const CONFIRM_ERROR_TOAST_ID = "confirm-error";

/** The one preset. Others get added when a screen actually needs them. */
export function confirmDelete(entity: string, name?: string): ConfirmOptions {
  return {
    title: `Delete ${entity}?`,
    description: name
      ? `“${name}” will be permanently deleted. This can't be undone.`
      : `This ${entity} will be permanently deleted. This can't be undone.`,
    confirmLabel: "Delete",
    tone: "error",
  };
}
