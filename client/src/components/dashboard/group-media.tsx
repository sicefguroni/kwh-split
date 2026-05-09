import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const FALLBACK_GRADIENT =
  "bg-[linear-gradient(135deg,rgba(15,23,42,1)_0%,rgba(14,116,144,0.94)_58%,rgba(103,232,249,0.9)_130%)]";

const getGroupInitials = (name: string): string => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "G";
};

interface GroupAvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  imageUrl?: string | undefined;
  imageClassName?: string;
  fallbackClassName?: string;
  alt?: string;
}

export function GroupAvatar({
  name,
  imageUrl,
  className,
  imageClassName,
  fallbackClassName,
  alt,
  ...props
}: GroupAvatarProps) {
  const initials = getGroupInitials(name);

  return (
    <div className={cn("overflow-hidden", className)} {...props}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt ?? name} className={cn("h-full w-full object-cover", imageClassName)} />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center text-center font-semibold uppercase tracking-[0.14em] text-white",
            FALLBACK_GRADIENT,
            fallbackClassName,
          )}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
    </div>
  );
}

interface GroupCoverBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  imageUrl?: string | undefined;
  overlayClassName?: string;
  children?: ReactNode;
}

export function GroupCoverBackground({
  name,
  imageUrl,
  className,
  overlayClassName,
  children,
  ...props
}: GroupCoverBackgroundProps) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-950", className)} {...props}>
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} cover`} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={cn("absolute inset-0", FALLBACK_GRADIENT)} aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_34%)]" />
          <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-white/12 blur-2xl" />
          <div className="absolute bottom-5 right-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl font-semibold uppercase tracking-[0.14em] text-white/90 shadow-lg backdrop-blur-sm">
            {getGroupInitials(name)}
          </div>
        </div>
      )}
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-950/30 to-transparent",
          overlayClassName,
        )}
      />
      {children ? <div className="relative h-full">{children}</div> : null}
    </div>
  );
}