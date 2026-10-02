"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** A diagram is not a type: it is a statement carrying a ```mermaid fence. */
const MERMAID_FENCE = /```mermaid\s*\n([\s\S]*?)```/;

export function extractDiagram(statement: string): string | null {
  return MERMAID_FENCE.exec(statement)?.[1]?.trim() ?? null;
}

/** Everything outside the fence stays plain text, rendered above the figure. */
export function statementWithoutDiagram(statement: string): string {
  return statement.replace(MERMAID_FENCE, "").trim();
}

// ssr:false so a page with no diagram never loads mermaid at all.
const MermaidFigure = dynamic(() => import("./mermaid-figure"), {
  ssr: false,
  loading: () => <Skeleton className="h-36 w-full" />,
});

export function DiagramBlock({ source }: { source: string }) {
  return <MermaidFigure source={source} />;
}
