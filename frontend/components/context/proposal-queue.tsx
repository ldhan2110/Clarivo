"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposalCard } from "./proposal-card";
import type { ProposalGroupDto, ProposalItemDto, ResolveConflictDto } from "@/types/api";

export function ProposalQueue({
  group,
  busy,
  onClose,
  onAccept,
  onReject,
  onAcceptAllAdds,
  onWriteOwn,
}: {
  group: ProposalGroupDto;
  busy: boolean;
  onClose: () => void;
  onAccept: (proposal: ProposalItemDto, body?: ResolveConflictDto) => void;
  onReject: (proposal: ProposalItemDto) => void;
  onAcceptAllAdds: (proposals: ProposalItemDto[]) => void;
  onWriteOwn: (proposal: ProposalItemDto) => void;
}) {
  // "Accept all" is offered for the add-only subset and never across updates
  // or conflicts — those are decisions, not a batch.
  const adds = group.proposals.filter((proposal) => proposal.kind === "add");

  return (
    <Card data-testid="proposal-queue">
      <CardHeader>
        <CardTitle>Reviewing {group.documentTitle}</CardTitle>
        <Badge variant="outline" className="ml-2">
          {group.proposals.length} open
        </Badge>
        <span className="ml-auto flex items-center gap-1.5">
          {adds.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onAcceptAllAdds(adds)}
            >
              Accept all {adds.length} new
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label="Close the review queue"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </span>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {group.proposals.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Every proposal from this document has been resolved.
          </p>
        ) : (
          group.proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              busy={busy}
              onAccept={(body) => onAccept(proposal, body)}
              onReject={() => onReject(proposal)}
              onWriteOwn={() => onWriteOwn(proposal)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** The bar above the page. Hidden at zero proposals. */
export function ProposalBar({
  groups,
  onReview,
}: {
  groups: ProposalGroupDto[];
  onReview: (documentId: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div data-testid="proposal-bar" className="mb-4 grid gap-2">
      {groups.map((group) => (
        <div
          key={group.documentId}
          className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-primary/35 bg-primary/8 px-3.5 py-2.5"
        >
          <span className="text-xs text-foreground">
            <b>{group.proposals.length}</b>{" "}
            {group.proposals.length === 1 ? "proposal" : "proposals"} from {group.documentTitle}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onReview(group.documentId)}
          >
            Review
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Replaces the documents card while reviewing: what this document produced. */
export function SourcePanel({ group }: { group: ProposalGroupDto }) {
  const counts = {
    add: group.proposals.filter((p) => p.kind === "add").length,
    update: group.proposals.filter((p) => p.kind === "update").length,
    conflict: group.proposals.filter((p) => p.kind === "conflict").length,
  };

  return (
    <Card data-testid="review-source-panel">
      <CardHeader>
        <CardTitle>Source</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium">{group.documentTitle}</p>
        <dl className="mt-3 grid gap-2 text-xs">
          <Count label="New blocks" value={counts.add} />
          <Count label="Updates" value={counts.update} />
          <Count label="Conflicts" value={counts.conflict} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Every proposal carries the verbatim quote it came from. Whichever side of a conflict
          loses is kept with its source, so the disagreement survives.
        </p>
      </CardContent>
    </Card>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto font-medium">{value}</dd>
    </div>
  );
}
