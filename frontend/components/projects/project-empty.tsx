"use client";

import { FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Two genuinely different empty states, as two components. One component
 * serving both is the usual bug here: "no projects yet" wants the create CTA
 * and no search, "nothing matched" wants Clear filters and no CTA.
 */
export function NoProjectsYet({ action }: { action?: React.ReactNode }) {
  return (
    <div
      data-testid="projects-empty"
      className="grid place-items-center gap-2.5 px-5 py-14 text-center"
    >
      <FolderKanban className="size-9 text-muted-foreground" strokeWidth={1.6} />
      <h2 className="text-sm font-semibold">No projects yet</h2>
      <p className="max-w-[36ch] text-xs text-muted-foreground">
        A project is where meeting notes turn into requirements.
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function NoProjectsMatch({ term, onClear }: { term: string; onClear: () => void }) {
  return (
    <div
      data-testid="projects-no-match"
      className="grid place-items-center gap-2.5 px-5 py-14 text-center"
    >
      <Search className="size-9 text-muted-foreground" strokeWidth={1.6} />
      <h2 className="text-sm font-semibold">
        {term ? `No projects match “${term}”` : "No projects match these filters"}
      </h2>
      <p className="max-w-[36ch] text-xs text-muted-foreground">
        Try a different search term, or switch the status filter.
      </p>
      <Button variant="outline" size="sm" className="mt-1" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
