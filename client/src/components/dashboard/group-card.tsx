import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import type { GroupMember } from "@/hooks/use-groups";

interface GroupCardProps {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  balance: number; // positive means you lent, negative means you owe
  currency: string;
  members: GroupMember[];
  onEdit?: () => void;
  onDelete?: () => void;
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPositive = balance >= 0;
  const balanceText = isPositive ? "group owes you" : "you owe";
  const absBalance = Math.abs(balance);
  const formattedBalance = `${currency}${absBalance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const previewMembers = members.slice(0, 3);

  return (
    <Link
      to={`/group/${id}`}
      className="group relative flex w-full flex-col gap-3 rounded-[24px] border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:rounded-[28px]"
      style={{
        background:
          "var(--Log-in-Background, linear-gradient(180deg, var(--Blue, #D0EEF0) 66.83%, #F7F8F9 100%))",
        borderColor: "var(--Blue-fr, #63C4F6)",
        filter: "drop-shadow(0 4px 4px rgba(255, 255, 255, 0.44))",
      }}
    >
      <div className="flex items-start gap-3 overflow-visible sm:gap-4 lg:items-center">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[18px] bg-slate-100 sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-[22px] lg:h-14 lg:w-14">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xl font-bold text-slate-700">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5 sm:gap-4 sm:pt-1">
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3 lg:items-center lg:gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-md font-semibold uppercase leading-tight tracking-tight text-slate-800 lg:text-lg">
                {name}
              </h3>
              {description ? (
                <p className="mt-1 truncate text-xs text-slate-600 sm:text-sm">{description}</p>
              ) : null}
            </div>
            <div className="hidden lg:flex shrink-0 items-center gap-2 rounded-full border border-white/70 bg-white/85 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm">
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
            <div className="relative shrink-0">
              <button
                type="button"
                className="rounded-full p-1 text-slate-800 transition-colors group-hover:bg-white/50"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsMenuOpen((prev) => !prev);
                }}
              >
                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {isMenuOpen ? (
                <div
                  className="absolute right-0 top-full z-20 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEdit?.();
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete?.();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ) : null}
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
                  "flex h-5 w-5 lg:h-7 lg:w-7 text-[10px] lg:text-xs items-center justify-center rounded-full border-2 border-white text-slate-900",
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
            <div className="h-5 w-5 lg:h-7 lg:w-7 rounded-full border-2 border-white bg-slate-100" aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 pr-3">
          <p className="min-w-0 text-center font-medium uppercase tracking-[0.08em] text-sky-700 text-[8px] lg:text-xs">
            {balanceText}
          </p>
          <p
            className={cn(
              "shrink-0 text-right text-base font-semibold leading-none text-sm lg:text-lg",
              isPositive ? "text-sky-950" : "text-rose-700",
            )}
          >
            {formattedBalance}
          </p>
        </div>
      </div>
    </Link>
  );
}
