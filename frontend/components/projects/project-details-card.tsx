"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateProject } from "@/hooks/use-project";
import { apiErrorMessage } from "@/lib/api-error";
import type { ProjectDto } from "@/types/api";
import { ProjectFields } from "./project-fields";
import { errorCode, PROJECT_FIELD_ERRORS } from "./project-field-errors";
import { projectSchema, toProjectBody, type ProjectFormValues } from "./project-schema";

function toValues(project: ProjectDto): ProjectFormValues {
  return {
    code: project.code,
    name: project.name,
    customerBu: project.customerBu,
    domain: project.domain,
    objective: project.objective ?? "",
    startsOn: project.startsOn ?? "",
    endsOn: project.endsOn ?? "",
  };
}

/** The same six fields and the same schema as the create dialog, inline. */
export function ProjectDetailsCard({
  project,
  disabled,
}: {
  project: ProjectDto;
  disabled?: boolean;
}) {
  const update = useUpdateProject(project.id);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: toValues(project),
  });

  const busy = isSubmitting || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("root");
    try {
      const saved = await update.mutateAsync(toProjectBody(values));
      // reset() with the saved values is what clears `isDirty`.
      reset(toValues(saved));
      toast.success("Project updated");
    } catch (error) {
      const mapped = PROJECT_FIELD_ERRORS[errorCode(error) ?? ""];
      if (mapped) setError(mapped.field, { message: mapped.message });
      else setError("root", { message: apiErrorMessage(error) });
    }
  });

  return (
    <Card data-testid="project-details-card">
      <CardHeader>
        <CardTitle>Project details</CardTitle>
        {isDirty && !disabled && (
          <Badge variant="outline" className="ml-auto" data-testid="unsaved-changes">
            Unsaved changes
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          {errors.root && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[10px] border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {errors.root.message}
            </p>
          )}

          <ProjectFields
            register={register}
            errors={errors}
            disabled={busy || disabled}
            idPrefix="settings-project"
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || busy || disabled}
              onClick={() => reset(toValues(project))}
            >
              Discard
            </Button>
            <Button type="submit" disabled={!isDirty || busy || disabled}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
