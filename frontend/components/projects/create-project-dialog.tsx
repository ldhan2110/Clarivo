"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateProject } from "@/hooks/use-project";
import { apiErrorMessage } from "@/lib/api-error";
import { ProjectFields } from "./project-fields";
import { errorCode, PROJECT_FIELD_ERRORS } from "./project-field-errors";
import { projectSchema, toProjectBody, type ProjectFormValues } from "./project-schema";

const EMPTY: ProjectFormValues = {
  code: "",
  name: "",
  customerBu: "",
  domain: "",
  objective: "",
  startsOn: "",
  endsOn: "",
};

export function CreateProjectDialog({ domains }: { domains?: string[] }) {
  // UI-only state, never field values (frontend/CLAUDE.md).
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useCreateProject();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: EMPTY,
  });

  const busy = isSubmitting || create.isPending;

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("root");
    try {
      const project = await create.mutateAsync(toProjectBody(values));
      setOpen(false);
      reset(EMPTY);
      toast.success("Project created", { description: `“${project.name}” is ready.` });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      // A field error where the user can see which input is wrong; otherwise a
      // banner INSIDE the dialog, so every typed value survives the failure.
      const mapped = PROJECT_FIELD_ERRORS[errorCode(error) ?? ""];
      if (mapped) setError(mapped.field, { message: mapped.message });
      else setError("root", { message: apiErrorMessage(error) });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset(EMPTY);
      }}
    >
      <Button data-testid="new-project" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New project
      </Button>

      <DialogContent data-testid="create-project-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project is where meeting notes turn into requirements.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          {errors.root && (
            <p
              role="alert"
              data-testid="create-project-error"
              className="flex items-start gap-2 rounded-[10px] border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {errors.root.message}
            </p>
          )}

          <ProjectFields
            register={register}
            errors={errors}
            disabled={busy}
            domains={domains}
            idPrefix="create-project"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
