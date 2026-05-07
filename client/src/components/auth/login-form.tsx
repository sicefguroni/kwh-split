import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useLoginMutation } from "@/features/auth/use-auth";
import {
  LoginFormSchema,
  type LoginFormValues,
} from "@/features/auth/schemas";
import { SocialAuthButtons } from "./social-auth-buttons";

interface LocationState {
  from?: { pathname?: string };
}

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? "/dashboard";
  const oauthError = new URLSearchParams(location.search).get("oauthError");

  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const login = useLoginMutation();

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login.mutateAsync(values);
      navigate(from, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in";
      setSubmitError(message);
    }
  });

  const busy = isSubmitting || login.isPending;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <SocialAuthButtons />

      <div className="flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          icon={<Mail />}
          {...register("email")}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          icon={<Lock />}
          {...register("password")}
        />
      </Field>

      <div className="-mt-2 text-right">
        <button
          type="button"
          disabled
          className="text-xs font-medium text-ink-400"
          aria-label="Forgot password (coming soon)"
          title="Coming soon"
        >
          Forgot password?
        </button>
      </div>

      {submitError || oauthError ? (
        <p role="alert" className="text-sm text-danger">
          {submitError ?? oauthError}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={busy}>
        {busy ? <Spinner label="Signing in" /> : null}
        {busy ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
