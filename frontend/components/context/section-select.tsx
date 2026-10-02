"use client";

import { cn } from "@/lib/utils";
import { SECTION_LABELS } from "@/types/context";
import type { KnowledgeSection } from "@/types/context";

const SECTIONS = Object.keys(SECTION_LABELS) as KnowledgeSection[];

/**
 * ponytail: a native <select> styled with input.tsx's classes. There is no
 * select.tsx in this repo and the shadcn CLI hangs in this environment
 * (devspec/context/rules.md); nine options do not justify hand-copying Radix
 * Select. Swap to a Radix Select the first time this needs search, grouping or
 * a custom option row.
 */
export function SectionSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: KnowledgeSection;
  onChange: (section: KnowledgeSection) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      data-testid="section-select"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as KnowledgeSection)}
      className={cn(
        "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      )}
    >
      {SECTIONS.map((section) => (
        <option key={section} value={section}>
          {SECTION_LABELS[section]}
        </option>
      ))}
    </select>
  );
}
