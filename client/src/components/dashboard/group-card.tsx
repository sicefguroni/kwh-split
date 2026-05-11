import { Edit3, MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";
import { GroupAvatar } from "@/components/dashboard/group-media";
import type { GroupMember } from "@/hooks/use-groups";

const ACTION_MENU_WIDTH = 160;
const ACTION_MENU_HEIGHT = 104;
const ACTION_MENU_OFFSET = 8;
const ACTION_MENU_MARGIN = 12;

interface GroupCardProps {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | undefined;
  balance: number; // positive means you lent, negative means you owe
  currency: string;
  members: GroupMember[];
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

export function GroupCard({
  id,
  name,
  description,
  imageUrl,
  balance,
  currency,
  members,
  onEdit,
  onDelete,
}: GroupCardProps) {
  const isPositive = balance >= 0;
  const balanceText = isPositive ? "group owes you" : "you owe";
  const absBalance = Math.abs(balance);
  const formattedBalance = `${currency}${absBalance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const previewMembers = members.slice(0, 3);
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasActions = Boolean(onEdit || onDelete);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isMenuOpen || !hasActions) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - ACTION_MENU_MARGIN;
      const openUpward =
        spaceBelow < ACTION_MENU_HEIGHT && rect.top > ACTION_MENU_HEIGHT + ACTION_MENU_MARGIN;
      const top = openUpward
        ? Math.max(ACTION_MENU_MARGIN, rect.top - ACTION_MENU_HEIGHT - ACTION_MENU_OFFSET)
        : Math.min(
            rect.bottom + ACTION_MENU_OFFSET,
            window.innerHeight - ACTION_MENU_HEIGHT - ACTION_MENU_MARGIN,
          );
      const left = Math.min(
        Math.max(ACTION_MENU_MARGIN, rect.right - ACTION_MENU_WIDTH),
        window.innerWidth - ACTION_MENU_WIDTH - ACTION_MENU_MARGIN,
      );

      setMenuPosition({ top, left });
    };

    const handlePointerDown = (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      const target = event.target as Node | null;
      if (target && !menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [hasActions, isMenuOpen]);

  const handleMoreClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!hasActions) {
      return;
    }

    setIsMenuOpen((current) => !current);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && event.key === "Enter") {
      navigate(`/group/${id}`);
    }
  };

  const handleActionClick = (event: MouseEvent<HTMLButtonElement>, action?: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMenuOpen(false);
    action?.();
  };

  return (
    <>
      <article
        onClick={() => navigate(`/group/${id}`)}
        onKeyDown={handleCardKeyDown}
        role="link"
        tabIndex={0}
        aria-label={`Open ${name}`}
        className="group flex w-full cursor-pointer flex-col gap-3 rounded-[24px] border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:rounded-[28px]"
        style={{
          background:
            "var(--Log-in-Background, linear-gradient(180deg, var(--Blue, #D0EEF0) 66.83%, #F7F8F9 100%))",
          borderColor: "var(--Blue-fr, #63C4F6)",
          filter: "drop-shadow(0 4px 4px rgba(255, 255, 255, 0.44))",
        }}
      >
        <div className="flex items-start gap-3 overflow-hidden sm:gap-4 lg:items-stretch">
        <GroupAvatar
          name={name}
          imageUrl={imageUrl}
          className="h-12 w-12 shrink-0 rounded-[18px] bg-slate-100 sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-[22px] lg:h-14 lg:w-14"
          imageClassName="transition-transform duration-300 group-hover:scale-105"
          fallbackClassName="text-sm sm:text-lg"
        />
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5 sm:gap-4 sm:pt-1 lg:gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-md font-semibold uppercase leading-tight tracking-tight text-slate-800 lg:text-lg">
              {name}
            </h3>
            {description ? (
              <p className="mt-1 truncate text-xs text-slate-600 sm:text-sm">{description}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end justify-start gap-3 self-stretch lg:justify-end">
            {hasActions ? (
              <button
                ref={triggerRef}
                type="button"
                aria-label={`Open actions for ${name}`}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={handleMoreClick}
                className="shrink-0 rounded-full border border-sky-100 bg-white/80 p-1.5 text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
              >
                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : null}

            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/70 bg-white/85 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm lg:flex">
              <div className="flex shrink-0 items-center -space-x-2.5">
                {previewMembers.length > 0 ? (
                  previewMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-slate-900",
                        index === 0 && "bg-slate-100",
                        index === 1 && "bg-slate-950 text-white",
                        index === 2 && "bg-emerald-300",
                      )}
                      aria-hidden="true"
                    >
                      {(member.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  ))
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-white bg-slate-100" aria-hidden="true" />
                )}
              </div>
              <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-sky-700">
                {balanceText}
              </p>
              <p
                className={cn(
                  "shrink-0 whitespace-nowrap text-base font-semibold leading-none",
                  isPositive ? "text-sky-950" : "text-rose-700",
                )}
              >
                {formattedBalance}
              </p>
            </div>
          </div>
        </div>
        </div>

        <div className="flex w-full items-center gap-2 rounded-[22px] border border-white/70 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm sm:gap-3 sm:rounded-full lg:hidden">
        <div className="flex shrink-0 items-center -space-x-3">
          {previewMembers.length > 0 ? (
            previewMembers.map((member, index) => (
              <div
                key={member.id}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] text-slate-900",
                  index === 0 && "bg-slate-100",
                  index === 1 && "bg-slate-950 text-white",
                  index === 2 && "bg-emerald-300",
                )}
                aria-hidden="true"
              >
                {(member.name ?? "?").charAt(0).toUpperCase()}
              </div>
            ))
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-white bg-slate-100" aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 pr-3">
          <p className="min-w-0 text-center text-[8px] font-medium uppercase tracking-[0.08em] text-sky-700">
            {balanceText}
          </p>
          <p
            className={cn(
              "shrink-0 text-right text-sm font-semibold leading-none",
              isPositive ? "text-sky-950" : "text-rose-700",
            )}
          >
            {formattedBalance}
          </p>
        </div>
        </div>
      </article>

      {hasActions && isMenuOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-40 min-w-[160px] rounded-2xl border border-slate-200 bg-white/98 p-1 shadow-[0_22px_50px_-18px_rgba(10,15,26,0.45)] backdrop-blur-sm"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              role="menu"
              aria-label={`${name} actions`}
            >
              {onEdit ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => handleActionClick(event, onEdit)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Edit3 className="h-4 w-4" /> Edit group
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => handleActionClick(event, onDelete)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete group
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
