import { cn } from "@/lib/cn";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeMap = {
  sm: "h-8 w-8 rounded-lg text-[8px]",
  md: "h-12 w-12 rounded-xl text-[10px]",
  lg: "h-20 w-20 rounded-2xl text-xs",
} as const;

export function Logo({ size = "md", className, label = "Split" }: LogoProps) {
  return (
    <div
      className={cn(
        "grid place-items-center border border-dashed border-ink-300 bg-ink-50 font-semibold uppercase tracking-wider text-ink-400 select-none",
        sizeMap[size],
        className,
      )}
      role="img"
      aria-label={label}
    >
      Logo
    </div>
  );
}
