import { ChevronRight, Users2, DollarSign } from "lucide-react";
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
}

export function GroupCard({
  id,
  name,
  description,
  imageUrl,
  balance,
  currency,
  members,
}: GroupCardProps) {
  const isPositive = balance >= 0;
  const balanceText = isPositive ? "you lent" : "you owe";
  const absBalance = Math.abs(balance);
  const formattedBalance = `${currency} ${absBalance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <Link
      to={`/group/${id}`}
      className="group relative flex items-center justify-between rounded-3xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-3xl bg-slate-100">
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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-slate-950">{name}</h3>
          {description ? (
            <p className="truncate text-sm text-slate-500">{description}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <Users2 className="h-3.5 w-3.5" /> {members.length} members
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <DollarSign className="h-3.5 w-3.5" /> {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-right">
        <div className="flex flex-col items-end">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">{balanceText}</p>
          <p
            className={cn(
              "text-sm font-semibold",
              isPositive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {formattedBalance}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
