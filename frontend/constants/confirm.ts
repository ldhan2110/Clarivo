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

/**
 * Archive, restore and remove-member. None of them reuses `confirmDelete`:
 * that preset is red and says "permanently deleted. This can't be undone.",
 * which is false for all three — archive is a status, and a removed member's
 * contributions stay.
 */
export function confirmArchive(projectName: string): ConfirmOptions {
  return {
    title: "Archive this project?",
    description: `“${projectName}” will be hidden from the active list and become read-only. Nothing is deleted, and you can restore it at any time.`,
    confirmLabel: "Archive project",
    tone: "warning",
  };
}

export function confirmRestore(projectName: string): ConfirmOptions {
  return {
    title: "Restore this project?",
    description: `“${projectName}” moves back into the active list.`,
    confirmLabel: "Restore project",
    tone: "confirm",
  };
}

export function confirmRemoveMember(memberName: string, projectName: string): ConfirmOptions {
  return {
    title: `Remove ${memberName}?`,
    description: `They lose access to “${projectName}” immediately. Anything they already contributed stays.`,
    confirmLabel: "Remove",
    tone: "warning",
  };
}

/**
 * Neither reuses `confirmDelete`. Its "permanently deleted. This can't be
 * undone." is false for both: an archived document is still downloadable, and
 * a deleted block can be proposed again by the next document that asserts it.
 */
export function confirmArchiveDocument(title: string): ConfirmOptions {
  return {
    title: "Archive this document?",
    description: `“${title}” leaves the documents list. Every block that cites it keeps its citations, and the document stays downloadable — so every citation still resolves.`,
    confirmLabel: "Archive document",
    tone: "warning",
  };
}

export function confirmDeleteBlock(): ConfirmOptions {
  return {
    title: "Delete this block?",
    description:
      "It disappears from the knowledge page. This is not a permanent no — a later document asserting the same thing will propose it again.",
    confirmLabel: "Delete block",
    tone: "error",
  };
}
