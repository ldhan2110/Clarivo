"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, Upload, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { initialsOf } from "@/components/sidebar/nav-user";
import {
  passwordErrorMessage,
  useChangePassword,
  useUpdateProfile,
  useUploadAvatar,
} from "@/hooks/use-profile";
import { useUser } from "@/stores/auth";

const AVATAR_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const AVATAR_MAX = 5 * 1024 * 1024;

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(255),
});
type NameForm = z.infer<typeof nameSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "At least 8 characters."),
    confirm: z.string().min(1, "Confirm your new password."),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });
type PasswordForm = z.infer<typeof passwordSchema>;

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useUser();

  // ----- avatar (persists on pick) -----
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const uploadAvatar = useUploadAvatar();

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;
    setAvatarError(null);
    if (!AVATAR_MIME.includes(file.type)) {
      setAvatarError("Choose a PNG, JPG, WebP or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX) {
      setAvatarError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Images must be 5 MB or smaller.`,
      );
      return;
    }
    setPreview(URL.createObjectURL(file));
    // mutate-scoped onSettled clears the local preview without standing down the
    // global error toast (that check reads the hook's options.onError, not this).
    uploadAvatar.mutate(file, { onSettled: () => setPreview(null) });
  }

  // ----- name -----
  const updateProfile = useUpdateProfile();
  const {
    register: registerName,
    handleSubmit: handleName,
    formState: { errors: nameErrors, isSubmitting: nameSubmitting },
  } = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    values: { name: user?.name ?? "" },
  });
  const nameBusy = nameSubmitting || updateProfile.isPending;
  const onSaveName = handleName(async (v) => {
    try {
      await updateProfile.mutateAsync(v);
    } catch {
      // error surfaces via the global toast (useUpdateProfile has no onError)
    }
  });

  // ----- password -----
  const changePassword = useChangePassword();
  const {
    register: registerPw,
    handleSubmit: handlePw,
    reset: resetPw,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const pwBusy = pwSubmitting || changePassword.isPending;
  const onChangePassword = handlePw(async (v) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
      resetPw();
    } catch {
      // 401 renders inline below via changePassword.error
    }
  });

  const avatarSrc = preview ?? (user?.avatarFileId ? `/api/files/${user.avatarFileId}` : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Manage your photo, name and password.</DialogDescription>
        </DialogHeader>

        {/* ---------- Photo & name ---------- */}
        <section className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
            Photo &amp; name
          </p>

          <div className="flex items-center gap-4">
            <Avatar className="size-[72px] rounded-[16px] bg-linear-140 from-chart-3 to-chart-1">
              {avatarSrc && <AvatarImage src={avatarSrc} alt="" className="object-cover" />}
              <AvatarFallback className="bg-transparent text-xl font-semibold text-primary-foreground">
                {user ? initialsOf(user.name) || <UserIcon className="size-5" /> : null}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_MIME.join(",")}
                hidden
                onChange={onPickAvatar}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadAvatar.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {uploadAvatar.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload photo
                  </>
                )}
              </Button>
              {avatarError ? (
                <span className="text-destructive text-[12.5px]">{avatarError}</span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  PNG, JPG, WebP or GIF · max 5 MB
                </span>
              )}
            </div>
          </div>

          <form onSubmit={onSaveName} noValidate className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              disabled={nameBusy}
              aria-invalid={Boolean(nameErrors.name)}
              {...registerName("name")}
            />
            {nameErrors.name && (
              <span className="text-destructive text-[12.5px]">{nameErrors.name.message}</span>
            )}
            <div className="mt-1 flex justify-end">
              <Button type="submit" disabled={nameBusy}>
                {nameBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </section>

        <Separator />

        {/* ---------- Change password ---------- */}
        <form onSubmit={onChangePassword} noValidate className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
            Change password
          </p>

          {changePassword.isError && (
            <div
              role="alert"
              className="border-destructive/35 text-destructive flex items-start gap-2.5 rounded-[10px] border bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))] px-3 py-2 text-[13px] leading-snug"
            >
              <AlertCircle className="mt-px size-4 shrink-0" />
              <span>{passwordErrorMessage(changePassword.error)}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              disabled={pwBusy}
              aria-invalid={Boolean(pwErrors.currentPassword)}
              {...registerPw("currentPassword")}
            />
            {pwErrors.currentPassword && (
              <span className="text-destructive text-[12.5px]">
                {pwErrors.currentPassword.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              disabled={pwBusy}
              aria-invalid={Boolean(pwErrors.newPassword)}
              {...registerPw("newPassword")}
            />
            {pwErrors.newPassword && (
              <span className="text-destructive text-[12.5px]">
                {pwErrors.newPassword.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              disabled={pwBusy}
              aria-invalid={Boolean(pwErrors.confirm)}
              {...registerPw("confirm")}
            />
            {pwErrors.confirm && (
              <span className="text-destructive text-[12.5px]">{pwErrors.confirm.message}</span>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pwBusy}>
              {pwBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
