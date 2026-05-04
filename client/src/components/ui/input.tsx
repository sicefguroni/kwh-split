import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, invalid, ...props }, ref) => (
    <div
      className={cn(
        "flex h-12 items-center gap-2 rounded-xl border bg-white px-3 transition-colors",
        "border-ink-200 focus-within:border-ink-900 focus-within:ring-2 focus-within:ring-ink-900/20",
        invalid && "border-danger focus-within:border-danger focus-within:ring-danger/20",
        className,
      )}
    >
      {icon ? (
        <span className="text-ink-400 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <input
        ref={ref}
        className="h-full w-full flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        aria-invalid={invalid ? true : undefined}
        {...props}
      />
    </div>
  ),
);
Input.displayName = "Input";
