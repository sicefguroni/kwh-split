import { usePersistentState } from "./use-persistent-state";

export interface GroupMember {
  id: string;
  name: string;
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
  splits: GroupExpenseSplit[];
  status: "pending" | "synced";
}

export interface GroupData {
  id: string;
  name: string;
  description: string;
  currency: string;
  imageUrl?: string;
  members: GroupMember[];
  balance: number;
  createdAt: string;
}

export const DEFAULT_GROUPS: GroupData[] = [
  {
    id: "1",
    name: "PADAGAT WHEN",
    description: "Palawan, Philippines",
    currency: "PHP",
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
    currency: "PHP",
    members: [
      { id: "1", name: "George", isAdmin: true },
      { id: "4", name: "John", isAdmin: false },
    ],
    balance: -4520.5,
    createdAt: new Date().toISOString(),
  },
];

export function useGroupsState(defaultGroups: GroupData[] = []) {
  return usePersistentState<GroupData[]>("split-groups", defaultGroups);
}
