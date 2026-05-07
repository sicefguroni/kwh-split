import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSignupMutation } from "@/features/auth/use-auth";
import {
  SignupFormSchema,
  type SignupFormValues,
} from "@/features/auth/schemas";
import { SocialAuthButtons } from "./social-auth-buttons";

export function SignupForm() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signup = useSignupMutation();

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signup.mutateAsync(values);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create account";
      setSubmitError(message);
    }
  });

  const busy = isSubmitting || signup.isPending;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <SocialAuthButtons />

      <div className="flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <Field label="Name" error={errors.name?.message}>
        <Input
          type="text"
          autoComplete="name"
          placeholder="Your name"
          icon={<User />}
          {...register("name")}
        />
      </Field>

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

      <Field
        label="Password"
        hint="At least 8 characters with upper, lower, and a number"
        error={errors.password?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          icon={<Lock />}
          {...register("password")}
        />
      </Field>

      <Field label="Confirm password" error={errors.confirmPassword?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          icon={<ShieldCheck />}
          {...register("confirmPassword")}
        />
      </Field>

      {submitError ? (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={busy}>
        {busy ? <Spinner label="Creating account" /> : null}
        {busy ? "Creating account…" : "Sign up"}
      </Button>
    </form>
  );
}
