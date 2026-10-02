import type { KnowledgeBlockDto, ProjectDocumentDto } from "@/types/api";

export type KnowledgeSection = KnowledgeBlockDto["section"];
export type DocumentStatus = ProjectDocumentDto["status"];

/** Fixed render order. The page shows every section, empty ones included —
 *  a gap is the signal that becomes a discovery question. */
export const SECTION_LABELS: Record<KnowledgeSection, string> = {
  overview: "Project brief",
  scope: "Scope",
  stakeholders: "Stakeholders",
  process: "Process",
  data_model: "Data model",
  constraints: "Constraints",
  integrations: "Integrations",
  glossary: "Glossary",
  open_questions: "Open questions",
};

export const CONFIDENCE_LABELS: Record<KnowledgeBlockDto["confidence"], string> = {
  stated: "stated",
  implied: "implied",
  uncertain: "uncertain",
};

/** What each pipeline status is called, and whether it is still moving. */
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Queued",
  parsing: "Reading",
  summarizing: "Summarizing",
  proposing: "Proposing",
  ready: "Read",
  failed: "Failed",
  archived: "Archived",
};

/** The four pipeline steps the progress pips walk through. */
export const PIPELINE_STEPS: DocumentStatus[] = [
  "pending",
  "parsing",
  "summarizing",
  "proposing",
];
