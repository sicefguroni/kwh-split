import type { Split, CoverageEntry } from './split'

export type SettlementEvent = {
  id: number
  expenseId: number
  fromUserId: number
  toUserId: number
  amount: number
  isSettled: boolean
  createdAt: Date
}

export type NetSettlement = {
  userId: number
  netAmount: number
  coverageSettled?: number
}

export interface SettlementEngine {
  computeNetSettlements(
    splits: Split[],
    coverageEntries: CoverageEntry[]
  ): NetSettlement[]

  generateSettlements(splits: Split[], coverageEntries: CoverageEntry[]): SettlementEvent[]

  minimizeTransactions(
    netSettlements: NetSettlement[],
    coverageEntries: CoverageEntry[]
  ): { userId: number; toUserId: number | null; amount: number }[]
}
