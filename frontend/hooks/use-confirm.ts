"use client";

import { useContext } from "react";
import { ConfirmContext } from "@/components/provider/confirm-provider";

/** Imperative confirm dialog. Resolves true when the user confirmed. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used inside <ConfirmProvider> (app/layout.tsx)");
  }
  return confirm;
}
