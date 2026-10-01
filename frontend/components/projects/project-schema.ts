import { z } from "zod";

/**
 * The one schema for the six project fields. The create dialog and the
 * settings details card both use it, so the two validation paths cannot drift.
 * Messages live here, never in JSX.
 */
export const projectSchema = z
  .object({
    code: z.string().trim().min(1, "Code is required").max(64, "Code is at most 64 characters"),
    name: z.string().trim().min(1, "Project name is required").max(255),
    customerBu: z.string().trim().min(1, "Customer / BU is required").max(255),
    domain: z.string().trim().min(1, "Domain is required").max(255),
    objective: z.string().trim().max(4000).optional(),
    startsOn: z.string().optional(),
    endsOn: z.string().optional(),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
    // On the end date, where the user can see which field is wrong. db.md
    // deliberately adds no CHECK constraint for this.
    path: ["endsOn"],
    message: "End date must be on or after the start date",
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

/** Empty strings are how a cleared optional field reaches the API as absent. */
export function toProjectBody(values: ProjectFormValues) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    customerBu: values.customerBu.trim(),
    domain: values.domain.trim(),
    objective: values.objective?.trim() ? values.objective.trim() : undefined,
    startsOn: values.startsOn || undefined,
    endsOn: values.endsOn || undefined,
  };
}
