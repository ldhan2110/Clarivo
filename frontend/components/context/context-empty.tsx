"use client";

import { FileText } from "lucide-react";

/**
 * Nothing uploaded yet. Follows components/projects/project-empty.tsx — the
 * CTA lives above the page, so this states what a document buys you and gets
 * out of the way.
 */
export function ContextEmpty({ action }: { action?: React.ReactNode }) {
  return (
    <div
      data-testid="context-empty"
      className="grid place-items-center gap-2.5 px-5 py-14 text-center"
    >
      <FileText className="size-9 text-muted-foreground" strokeWidth={1.6} />
      <h2 className="text-sm font-semibold">No context documents yet</h2>
      <p className="max-w-[42ch] text-xs text-muted-foreground">
        Upload an SRS, a kickoff deck or meeting minutes. Clarivo reads each one once and
        proposes what it learned — nothing lands on this page until you accept it.
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
