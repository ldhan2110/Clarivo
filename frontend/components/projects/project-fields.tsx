"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-schema";

/**
 * The six project fields, shared by the create dialog and the settings details
 * card so the two render and validate identically. Register-based, so no
 * `watch()` is needed anywhere (React Compiler + react-hooks/incompatible-library).
 */
export function ProjectFields({
  register,
  errors,
  disabled,
  domains,
  idPrefix,
}: {
  register: UseFormRegister<ProjectFormValues>;
  errors: FieldErrors<ProjectFormValues>;
  disabled?: boolean;
  /** The viewer's existing domains, offered as a datalist. Still free text. */
  domains?: string[];
  idPrefix: string;
}) {
  const listId = `${idPrefix}-domains`;

  return (
    <div className="grid gap-3.5">
      <Field id={`${idPrefix}-code`} label="Code" required error={errors.code?.message}>
        <Input
          id={`${idPrefix}-code`}
          placeholder="CLT-DevSpec"
          disabled={disabled}
          aria-invalid={Boolean(errors.code)}
          {...register("code")}
        />
      </Field>

      <Field id={`${idPrefix}-name`} label="Project name" required error={errors.name?.message}>
        <Input
          id={`${idPrefix}-name`}
          placeholder="Clarivo DevSpec"
          disabled={disabled}
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-customerBu`}
          label="Customer / BU"
          required
          error={errors.customerBu?.message}
        >
          <Input
            id={`${idPrefix}-customerBu`}
            placeholder="CLT"
            disabled={disabled}
            aria-invalid={Boolean(errors.customerBu)}
            {...register("customerBu")}
          />
        </Field>

        <Field id={`${idPrefix}-domain`} label="Domain" required error={errors.domain?.message}>
          <Input
            id={`${idPrefix}-domain`}
            placeholder="Logistics"
            list={listId}
            disabled={disabled}
            aria-invalid={Boolean(errors.domain)}
            {...register("domain")}
          />
          {/* Free text with suggestions — the column has no CHECK constraint. */}
          <datalist id={listId}>
            {domains?.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field id={`${idPrefix}-objective`} label="Objective" error={errors.objective?.message}>
        <Textarea
          id={`${idPrefix}-objective`}
          rows={3}
          placeholder="What this project is trying to achieve."
          disabled={disabled}
          {...register("objective")}
        />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field id={`${idPrefix}-startsOn`} label="Starts on" error={errors.startsOn?.message}>
          <Input
            id={`${idPrefix}-startsOn`}
            type="date"
            disabled={disabled}
            {...register("startsOn")}
          />
        </Field>

        <Field id={`${idPrefix}-endsOn`} label="Ends on" error={errors.endsOn?.message}>
          <Input
            id={`${idPrefix}-endsOn`}
            type="date"
            disabled={disabled}
            aria-invalid={Boolean(errors.endsOn)}
            {...register("endsOn")}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={cn(error && "text-destructive")}>
        {label}
        {required && <span aria-hidden className="text-destructive">*</span>}
        {!required && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
