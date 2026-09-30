"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, useLogin } from "@/hooks/use-auth";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  remember: z.boolean(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const busy = isSubmitting || login.isPending;

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("root");
    try {
      await login.mutateAsync(values);
      // refresh() re-runs middleware so the new cookie is seen immediately
      router.replace("/");
      router.refresh();
    } catch (error) {
      setError("root", { message: authErrorMessage(error) });
    }
  });

  return (
    // ponytail: h-dvh + overflow-hidden never scrolls; `short:` trims spacing so the
    // card fits down to ~450px of viewport height. Below that it clips.
    <main className="bg-secondary dark:bg-background relative flex h-dvh items-center justify-center overflow-hidden px-3 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] min-[360px]:px-4 min-[360px]:pt-6 min-[360px]:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 short:py-4">
      {/* brand glow, not a photograph — nothing to download */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(90%_70%_at_50%_-10%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)]"
      />

      <div className="bg-card border-border relative w-full max-w-[440px] overflow-hidden rounded-[20px] border shadow-[0_1px_2px_rgb(15_23_42/0.05),0_16px_40px_-14px_rgb(15_23_42/0.18)] sm:max-panel:max-w-[452px] panel:grid panel:max-w-[960px] panel:grid-cols-[48%_52%] panel:items-stretch">
        <aside className="px-4 pt-6 min-[360px]:px-6 min-[360px]:pt-7 sm:px-[34px] sm:pt-[34px] short:pt-4 short:max-panel:pb-0 panel:border-border panel:bg-secondary panel:flex panel:flex-col panel:gap-[22px] panel:border-r panel:p-[34px]">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/clarivo-mark.png"
              alt=""
              width={64}
              height={64}
              priority
              className="h-8 w-auto"
            />
            <span className="text-card-foreground text-2xl font-bold tracking-[-0.022em]">
              Clarivo
            </span>
          </div>

          {/*
            The illustration URL lives only inside a min-width rule, so phones
            never request the file at all — `hidden` alone would still fetch it.
          */}
          <div
            aria-hidden
            className="hidden flex-1 rounded-[14px] bg-contain bg-center bg-no-repeat panel:block panel:bg-[url(/images/login-background.webp)]"
          />
        </aside>

        <section className="flex flex-col px-4 pt-3.5 pb-5 min-[360px]:px-6 min-[360px]:pt-4 min-[360px]:pb-6 sm:px-[34px] sm:pb-[30px] short:pt-2.5 short:pb-4 panel:justify-center panel:p-10 panel:short:p-6">
          <h1 className="text-muted-foreground text-[15px] leading-normal font-medium min-[360px]:text-base">
            <b className="text-card-foreground font-bold">Welcome back</b> — sign in to your
            workspace.
          </h1>

          <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-3.5 min-[360px]:mt-6 min-[360px]:gap-[15px] short:mt-3.5 short:gap-2.5">
            {errors.root && (
              <div
                role="alert"
                className="border-destructive/35 text-destructive flex items-start gap-2.5 rounded-[12px] border bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))] px-3.5 py-3 text-[13px] leading-snug"
              >
                <AlertCircle className="mt-px size-4 shrink-0" />
                <span>{errors.root.message}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email
              </Label>
              <div className="relative flex items-center">
                <Mail className="text-muted-foreground pointer-events-none absolute left-3 size-[18px] min-[360px]:left-3.5" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={busy}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                  className="h-[50px] rounded-[12px] pl-10 text-base min-[360px]:pl-11 short:h-[42px] panel:h-[46px] panel:text-[15px] panel:short:h-[42px]"
                />
              </div>
              {errors.email && (
                <span id="email-error" className="text-destructive text-[12.5px]">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative flex items-center">
                <Lock className="text-muted-foreground pointer-events-none absolute left-3 size-[18px] min-[360px]:left-3.5" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={busy}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                  className="h-[50px] rounded-[12px] pr-11 pl-10 text-base min-[360px]:pr-[50px] min-[360px]:pl-11 short:h-[42px] panel:h-[46px] panel:text-[15px] panel:short:h-[42px]"
                />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground active:bg-accent absolute right-[3px] flex size-11 items-center justify-center rounded-lg transition-colors short:size-[38px] panel:size-[42px]"
                  >
                    {showPassword ? (
                      <EyeOff className="size-[18px]" />
                    ) : (
                      <Eye className="size-[18px]" />
                    )}
                  </button>
                )}
              </div>
              {errors.password && (
                <span id="password-error" className="text-destructive text-[12.5px]">
                  {errors.password.message}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              {/* the whole label is the tap target, not just the 20px box */}
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] whitespace-nowrap select-none min-[360px]:gap-2.5 min-[360px]:text-sm short:min-h-8 panel:min-h-0">
                {/* Controller, not watch() — watch() breaks React Compiler memoization */}
                <Controller
                  control={control}
                  name="remember"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      disabled={busy}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      className="size-5"
                    />
                  )}
                />
                Remember me
              </label>
              <a
                href="#"
                className="text-primary flex min-h-11 items-center text-[13px] font-medium whitespace-nowrap hover:underline min-[360px]:text-sm short:min-h-8 panel:min-h-0"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="mt-0.5 h-[50px] w-full rounded-[12px] text-[15px] font-semibold short:h-[44px] panel:h-[46px] panel:short:h-[44px]"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-muted-foreground mt-5 text-center text-[13px] min-[360px]:mt-6 min-[360px]:text-sm short:mt-3">
            Don&apos;t have an account?{" "}
            <a href="#" className="text-primary font-semibold hover:underline">
              Sign up
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
