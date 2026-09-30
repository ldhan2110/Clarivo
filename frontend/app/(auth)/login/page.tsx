"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_AUTH_ERROR = "Incorrect email or password.";

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => api.post("/auth/login", { email, password, remember }),
    onSuccess: () => {
      // refresh() re-runs middleware so the new cookie is seen immediately
      router.replace("/");
      router.refresh();
    },
    onError: (error: unknown) => {
      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
      // 401 is deliberately indistinguishable between unknown email and bad password
      setFormError(
        status === 401 ? GENERIC_AUTH_ERROR : "Something went wrong. Please try again.",
      );
    },
  });

  const busy = login.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const next: FieldErrors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";

    setFieldErrors(next);
    setFormError(null);
    // Local validation blocks the request entirely — nothing is sent.
    if (Object.keys(next).length > 0) return;

    login.mutate();
  }

  return (
    <main className="bg-secondary dark:bg-background relative flex min-h-screen items-center justify-center px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-14">
      {/* brand glow, not a photograph — nothing to download */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(90%_70%_at_50%_-10%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)]"
      />

      <div className="bg-card border-border relative w-full max-w-[440px] overflow-hidden rounded-[20px] border shadow-[0_1px_2px_rgb(15_23_42/0.05),0_16px_40px_-14px_rgb(15_23_42/0.18)] sm:max-panel:max-w-[452px] panel:grid panel:max-w-[960px] panel:grid-cols-[48%_52%] panel:items-stretch">
        <aside className="px-6 pt-7 sm:px-[34px] sm:pt-[34px] panel:border-border panel:bg-secondary panel:flex panel:flex-col panel:gap-[22px] panel:border-r panel:p-[34px]">
          <div className="flex items-center gap-2.5">
            <Image
              src="/clarivo-mark.png"
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
            className="hidden flex-1 rounded-[14px] bg-contain bg-center bg-no-repeat panel:block panel:bg-[url(/login-background.webp)]"
          />
        </aside>

        <section className="flex flex-col px-6 pt-4 pb-6 sm:px-[34px] sm:pb-[30px] panel:justify-center panel:p-10">
          <h1 className="text-muted-foreground text-base leading-normal font-medium">
            <b className="text-card-foreground font-bold">Welcome back</b> — sign in to your
            workspace.
          </h1>

          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-[15px]">
            {formError && (
              <div
                role="alert"
                className="border-destructive/35 text-destructive flex items-start gap-2.5 rounded-[12px] border bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))] px-3.5 py-3 text-[13px] leading-snug"
              >
                <AlertCircle className="mt-px size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email
              </Label>
              <div className="relative flex items-center">
                <Mail className="text-muted-foreground pointer-events-none absolute left-3.5 size-[18px]" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-[50px] rounded-[12px] pl-11 text-base panel:h-[46px] panel:text-[15px]"
                />
              </div>
              {fieldErrors.email && (
                <span id="email-error" className="text-destructive text-[12.5px]">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative flex items-center">
                <Lock className="text-muted-foreground pointer-events-none absolute left-3.5 size-[18px]" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[50px] rounded-[12px] pr-[50px] pl-11 text-base panel:h-[46px] panel:text-[15px]"
                />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground active:bg-accent absolute right-[3px] flex size-11 items-center justify-center rounded-lg transition-colors panel:size-[42px]"
                  >
                    {showPassword ? (
                      <EyeOff className="size-[18px]" />
                    ) : (
                      <Eye className="size-[18px]" />
                    )}
                  </button>
                )}
              </div>
              {fieldErrors.password && (
                <span id="password-error" className="text-destructive text-[12.5px]">
                  {fieldErrors.password}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* the whole label is the tap target, not just the 20px box */}
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm select-none panel:min-h-0">
                <Checkbox
                  checked={remember}
                  disabled={busy}
                  onCheckedChange={(v) => setRemember(v === true)}
                  className="size-5"
                />
                Remember me
              </label>
              <a
                href="#"
                className="text-primary flex min-h-11 items-center text-sm font-medium hover:underline panel:min-h-0"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="mt-0.5 h-[50px] w-full rounded-[12px] text-[15px] font-semibold panel:h-[46px]"
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

          <p className="text-muted-foreground mt-6 text-center text-sm">
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
