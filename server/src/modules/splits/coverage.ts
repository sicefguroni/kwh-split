import type { Expense } from 'server/src/modules/expenses/expenses.schemas'

export type CoverageEntry = {
  id: number
  expenseId: number
  payerUserId: number
  coveredUserId: number
  amountCovered: number
  isSettled: boolean
  createdAt: Date
}

export type CoverageFlow = {
  payerUserId: number
  coveredUserId: number
  amountCovered: number
  reason: string
}

export interface CoverageService {
  createCoverageEntries(
    expenseId: number,
    flows: CoverageFlow[],
    payerUserId: number
  ): Promise<CoverageEntry[]>

  settleCoverageEntries(
    expenseId: number,
    payerUserId: number,
    coveredUserId: number
  ): Promise<boolean>

  getUnsettledCoverageEntries(expenseId: number): Promise<CoverageEntry[]>
}
