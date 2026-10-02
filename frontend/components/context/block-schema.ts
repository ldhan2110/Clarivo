import { z } from "zod";
import { SECTION_LABELS } from "@/types/context";
import type { KnowledgeSection } from "@/types/context";

const SECTIONS = Object.keys(SECTION_LABELS) as [KnowledgeSection, ...KnowledgeSection[]];

/** Messages live in the schema, never in the JSX. */
export const citationSchema = z.object({
  documentId: z.string().min(1, "Choose the document this came from"),
  locator: z.string().max(64, "Keep the locator under 64 characters").optional(),
  quote: z.string().min(1, "Paste the sentence this came from"),
});

export const blockSchema = z.object({
  section: z.enum(SECTIONS),
  statement: z
    .string()
    .trim()
    .min(1, "Write the statement this block makes")
    .max(4000, "Keep a block to one assertion — under 4000 characters"),
  confidence: z.enum(["stated", "implied", "uncertain"]),
  refs: z.array(citationSchema),
});

export type BlockFormValues = z.infer<typeof blockSchema>;

export const EMPTY_BLOCK: BlockFormValues = {
  section: "scope",
  statement: "",
  confidence: "stated",
  refs: [],
};
