"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmRemoveMember } from "@/constants/confirm";
import { useAddMember, useProjectMembers, useRemoveMember } from "@/hooks/use-project-members";
import { useConfirm } from "@/hooks/use-confirm";
import { apiErrorMessage } from "@/lib/api-error";
import { useUser } from "@/stores/auth";
import type { ProjectDto, ProjectMemberDto } from "@/types/api";
import { errorCode } from "./project-field-errors";

const addMemberSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProjectMembersCard({
  project,
  disabled,
}: {
  project: ProjectDto;
  disabled?: boolean;
}) {
  const viewer = useUser();
  const { data: members = [], isPending } = useProjectMembers(project.id);
  const add = useAddMember(project.id);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: "" },
  });

  const busy = isSubmitting || add.isPending;

  const onAdd = handleSubmit(async (values) => {
    try {
      const member = await add.mutateAsync(values.email);
      reset({ email: "" });
      toast.success(`${member.name} added to the project`);
    } catch (error) {
      // Both of these are field errors under the email input, never toasts.
      const code = errorCode(error);
      if (code === "PROJECT_MEMBER_NOT_FOUND") {
        setError("email", { message: "No Clarivo account uses this email address." });
      } else if (code === "PROJECT_ALREADY_MEMBER") {
        setError("email", { message: "This person is already a member of this project." });
      } else {
        setError("email", { message: apiErrorMessage(error) });
      }
    }
  });

  return (
    <Card data-testid="project-members-card">
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <Badge variant="outline" className="ml-auto">
          {project.memberCount}
        </Badge>
      </CardHeader>
      <CardContent>
        <form onSubmit={onAdd} className="mb-3.5 grid gap-1.5">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Add a member by email…"
              aria-label="Add a member by email"
              data-testid="add-member-email"
              disabled={busy || disabled}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            <Button type="submit" disabled={busy || disabled}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Add member
            </Button>
          </div>
          {errors.email && (
            <p role="alert" data-testid="add-member-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </form>

        {isPending ? (
          <div className="grid gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-[11px]" />
            ))}
          </div>
        ) : (
          <>
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                project={project}
                isViewer={member.userId === viewer?.id}
                disabled={disabled}
              />
            ))}

            {members.length === 1 && (
              <p className="mt-2.5 text-xs text-muted-foreground">
                You&apos;re the only member. Add teammates by email so they can open this project.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  project,
  isViewer,
  disabled,
}: {
  member: ProjectMemberDto;
  project: ProjectDto;
  isViewer: boolean;
  disabled?: boolean;
}) {
  const confirm = useConfirm();
  const remove = useRemoveMember(project.id);

  return (
    <div
      data-testid="member-row"
      className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0"
    >
      <Avatar className="size-8">
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{member.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <Badge variant="outline">{member.role === "owner" ? "Owner" : "Member"}</Badge>
        {isViewer && <Badge variant="outline">You</Badge>}
        {/* No ✕ on the owner row — the API enforces this independently, and
            ownership transfer is deliberately out of scope. */}
        {member.role !== "owner" && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${member.name}`}
            data-testid="remove-member"
            disabled={disabled}
            onClick={() =>
              confirm({
                ...confirmRemoveMember(member.name, project.name),
                onConfirm: async () => {
                  await remove.mutateAsync(member.userId);
                  toast.success(`${member.name} removed`);
                },
              })
            }
          >
            <X className="size-4" />
          </Button>
        )}
      </span>
    </div>
  );
}
