import { brandMarkPublicPath } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const heightMap = {
  sm: "h-12",
  md: "h-[4.25rem]",
  lg: "h-[5.75rem] min-h-[3.5rem]",
} as const;

export function Logo({ size = "md", className }: LogoProps) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5 sm:p-2.5">
      <img
        src={brandMarkPublicPath}
        alt="Split"
        className={cn(heightMap[size], "w-auto object-contain object-center", className)}
      />
    </span>
  );
}
