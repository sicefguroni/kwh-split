import { useId, type ReactElement, type ReactNode } from "react";
import { cloneElement } from "react";
import { Label } from "./label";
import { cn } from "@/lib/cn";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: ReactElement<{ id?: string; invalid?: boolean }>;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const reactId = useId();
  const inputId = children.props.id ?? `field-${reactId}`;
  const hasError = Boolean(error);
  const messageId = hasError
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {cloneElement(children, {
        id: inputId,
        invalid: hasError,
        ...(messageId ? { "aria-describedby": messageId } : {}),
      } as Record<string, unknown>)}
      {hasError ? (
        <p id={messageId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FieldMessage({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-400">{children}</p>;
}
