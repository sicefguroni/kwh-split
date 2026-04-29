import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

interface GroupCardProps {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  balance: number; // positive means you lent, negative means you owe
}

export function GroupCard({
  id,
  name,
  description,
  imageUrl,
  balance,
}: GroupCardProps) {
  const isPositive = balance >= 0;
  const balanceText = isPositive ? "you lent" : "you owe";
  const absBalance = Math.abs(balance);
  const formattedBalance = `₱${absBalance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <Link
      to={`/group/${id}`}
      className="group relative flex items-center justify-between rounded-2xl bg-gradient-to-r from-mint-50 to-mint-100 p-3 pr-4 shadow-sm transition-all hover:shadow-md hover:from-mint-100 hover:to-mint-200"
    >
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-mint-200">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-mint-300 text-2xl font-bold text-mint-700">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col truncate">
          <h3 className="truncate text-base font-bold text-ink-900">{name}</h3>
          {description && (
            <p className="truncate text-xs font-medium text-mint-600">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pl-4 shrink-0">
        <div className="flex flex-col items-end text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {balanceText}
          </p>
          <p
            className={cn(
              "text-sm font-bold",
              isPositive ? "text-success" : "text-danger"
            )}
          >
            {formattedBalance}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-mint-500 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
