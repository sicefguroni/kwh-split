import { useEffect } from "react";
import { usePersistentState } from "./use-persistent-state";

const LEGACY_CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
};

const normalizeCurrency = (currency: string): string => LEGACY_CURRENCY_SYMBOLS[currency] ?? currency;

const normalizeGroupCurrency = (group: GroupData): GroupData => {
  const normalizedCurrency = normalizeCurrency(group.currency);
  return normalizedCurrency === group.currency
    ? group
    : { ...group, currency: normalizedCurrency };
};

export interface GroupMember {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
}

export interface GroupExpenseSplit {
  memberId: string;
  amount: number;
}

export interface GroupExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  paidBy: string;
  date: string;
  note?: string;
  splitType?: "equal" | "percentage" | "shares" | "exact" | "itemized";
  splits: GroupExpenseSplit[];
  memberDiscounts?: Array<{ memberId: string; type: "none" | "pwd" | "senior" }>;
  status: "pending" | "synced";
}

export interface GroupData {
  id: string;
  name: string;
  description: string;
  currency: string;
  imageUrl?: string | undefined;
  members: GroupMember[];
  balance: number;
  createdAt: string;
  role?: string | undefined;
}

export const DEFAULT_GROUPS: GroupData[] = [
  {
    id: "1",
    name: "PADAGAT WHEN",
    description: "Palawan, Philippines",
    currency: "₱",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80",
    members: [
      { id: "1", name: "George", isAdmin: true },
      { id: "2", name: "Alice", isAdmin: false },
      { id: "3", name: "May", isAdmin: false },
    ],
    balance: 1750.0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Mini Laguna",
    description: "Utang with the crew",
    currency: "₱",
    members: [
      { id: "1", name: "George", isAdmin: true },
      { id: "4", name: "John", isAdmin: false },
    ],
    balance: -4520.5,
    createdAt: new Date().toISOString(),
  },
];

export function useGroupsState(defaultGroups: GroupData[] = []) {
  const [groups, setGroups] = usePersistentState<GroupData[]>(
    "split-groups",
    defaultGroups.map(normalizeGroupCurrency),
  );

  useEffect(() => {
    setGroups((prev) => {
      let changed = false;
      const next = prev.map((group) => {
        const normalizedGroup = normalizeGroupCurrency(group);
        if (normalizedGroup !== group) {
          changed = true;
        }
        return normalizedGroup;
      });

      return changed ? next : prev;
    });
  }, [setGroups]);

  return [groups, setGroups] as const;
}
