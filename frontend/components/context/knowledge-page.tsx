"use client";

import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SECTION_LABELS } from "@/types/context";
import { KnowledgeBlock } from "./knowledge-block";
import { ProjectBrief } from "./project-brief";
import type { KnowledgeBlockDto, KnowledgePageDto } from "@/types/api";

export function KnowledgePage({
  page,
  isPending,
  readOnly,
  isRegenerating,
  onRegenerateBrief,
  onEditBlock,
  onDeleteBlock,
}: {
  page?: KnowledgePageDto;
  isPending: boolean;
  readOnly: boolean;
  isRegenerating: boolean;
  onRegenerateBrief: () => void;
  onEditBlock: (block: KnowledgeBlockDto) => void;
  onDeleteBlock: (block: KnowledgeBlockDto) => void;
}) {
  if (isPending) {
    return (
      <Card data-testid="knowledge-page">
        <CardHeader>
          <CardTitle>Project knowledge</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sections = page?.sections ?? [];
  const brief = sections.find((section) => section.section === "overview")?.blocks[0];

  return (
    <Card data-testid="knowledge-page">
      <CardHeader>
        <CardTitle>Project knowledge</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectBrief
          brief={brief}
          staleCount={page?.briefStaleCount ?? 0}
          readOnly={readOnly}
          isRegenerating={isRegenerating}
          onRegenerate={onRegenerateBrief}
          onEdit={onEditBlock}
        />

        {/* Every section renders, including empty ones — the gap is the signal. */}
        {sections
          .filter((section) => section.section !== "overview")
          .map((section) => (
            <section
              key={section.section}
              data-testid="knowledge-section"
              data-section={section.section}
              className="mb-5 last:mb-0"
            >
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {SECTION_LABELS[section.section]}
                </h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {section.blocks.length}
                </span>
              </div>

              {section.blocks.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-border px-3 py-2.5">
                  <Badge variant="outline" data-testid="ask-about-this">
                    <CircleHelp className="size-3" />
                    Ask about this
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Nothing known yet — this gap becomes a discovery question.
                  </span>
                </div>
              ) : (
                section.blocks.map((block) => (
                  <KnowledgeBlock
                    key={block.id}
                    block={block}
                    readOnly={readOnly}
                    onEdit={onEditBlock}
                    onDelete={onDeleteBlock}
                  />
                ))
              )}
            </section>
          ))}
      </CardContent>
    </Card>
  );
}
