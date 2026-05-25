import { Expense, ExpenseCreate } from 'server/src/modules/expenses/expenses.schemas'
import type { GroupMemberDiscount } from 'server/src/modules/groups/group.schemas'

export type Split = {
  userId: number
  amountOwed: number
  originalAmount: number
  discountApplied?: number
}

export type Payer = {
  userId: number
  amount: number
}

export type DiscountProrationMethod = 'equal' | 'proportional' | 'payer'

export type SplitType = 'equal' | 'percentage' | 'shares' | 'exact' | 'itemized'

export interface CalculateSplitsOptions {
  expense: Expense
  splitType: SplitType
  payerUserIds?: number[]
  payerAmounts?: number[]
  discountProrationMethod?: DiscountProrationMethod
}

export interface SplitsResult {
  splits: Split[]
  prorationApplied?: number
  prorationMethod: DiscountProrationMethod
  payerInfo?: Payer[]
}

export function calculateSplits(
  expense: Expense,
  options: CalculateSplitsOptions
): SplitsResult {
  const { expense, splitType, payerUserIds, payerAmounts, discountProrationMethod = 'equal' }
    = options
  
  if (splitType === 'exact') {
    return calculateExactSplits(expense, payerUserIds, payerAmounts)
  }

  const baseSplits = calculateBaseSplits(expense, splitType)
  const proration = applyDiscounts(
    baseSplits,
    expense.memberDiscounts,
    discountProrationMethod
  )

  return {
    splits: proration,
    prorationApplied: prorationAppliedCents(proration),
    prorationMethod: discountProrationMethod,
    payerInfo: payerUserIds ? buildPayerInfo(payerUserIds, payerAmounts, expense.totalAmount) : undefined
  }
}

function calculateBaseSplits(expense: Expense, splitType: SplitType): Split[] {
  switch (splitType) {
    case 'equal':
      return calculateEqualSplits(expense)
    case 'percentage':
      return calculatePercentageSplits(expense)
    case 'shares':
      return calculateShareSplits(expense)
    case 'itemized':
      return calculateItemizedSplits(expense)
    default:
      throw new Error(`Unknown split type: ${splitType}`)
  }
}

function calculateEqualSplits(expense: Expense): Split[] {
  const { totalAmount, participantUserIds } = expense
  const participants = participantUserIds
  const shareCents = Math.floor(totalAmount * 100 / participants)
  const remainderCents = totalAmount * 100 - shareCents * participants

  const baseSplits: Split[] = participants.map((userId) => ({
    userId,
    amountOwed: shareCents,
    originalAmount: shareCents
  }))

  if (remainderCents > 0) {
    const sorted = [...baseSplits].sort((a, b) => {
      const aRemainder = (a.amountOwed * 100 % 100) / 100
      const bRemainder = (b.amountOwed * 100 % 100) / 100
      return bRemainder - aRemainder
    })
    for (let i = 0; i < remainderCents; i++) {
      sorted[i].amountOwed += 1
    }
  }

  return baseSplits
}

function calculatePercentageSplits(expense: Expense): Split[] {
  const { totalAmount, splits: percentageSplits, participantUserIds } = expense
  if (!percentageSplits || percentageSplits.length !== participantUserIds.length) {
    throw new Error('Percentage splits require per-user percentage values')
  }

  const percentageSum = percentageSplits.reduce((sum, p) => sum + p.percentage, 0)
  if (!Number.isInteger(percentageSum) || percentageSum !== 100) {
    throw new Error('Percentage splits must sum to exactly 100')
  }

  const splits: Split[] = percentageSplits.map((p, i) => ({
    userId: participantUserIds[i],
    amountOwed: Math.floor(totalAmount * p.percentage / 100),
    originalAmount: Math.floor(totalAmount * p.percentage / 100)
  }))

  const remainderCents = totalAmount * 100 - splits.reduce((sum, s) => sum + s.amountOwed, 0)
  if (remainderCents !== 0) {
    const sorted = [...splits].sort((a, b) => {
      const aRemainder = (a.amountOwed * 100 % 100) / 100
      const bRemainder = (b.amountOwed * 100 % 100) / 100
      return bRemainder - aRemainder
    })
    for (let i = 0; i < remainderCents; i++) {
      sorted[i].amountOwed += 1
    }
  }

  return splits
}

function calculateShareSplits(expense: Expense): Split[] {
  const { totalAmount, splits: shareSplits, participantUserIds } = expense
  if (!shareSplits || shareSplits.length !== participantUserIds.length) {
    throw new Error('Share splits require per-user share values')
  }

  const totalShares = shareSplits.reduce((sum, s) => sum + s.shares, 0)
  if (totalShares === 0) {
    throw new Error('Share splits cannot have zero total shares')
  }

  const splits: Split[] = shareSplits.map((s, i) => ({
    userId: participantUserIds[i],
    amountOwed: Math.floor(totalAmount * s.shares / totalShares),
    originalAmount: Math.floor(totalAmount * s.shares / totalShares)
  }))

  const remainderCents = totalAmount * 100 - splits.reduce((sum, s) => sum + s.amountOwed, 0)
  if (remainderCents !== 0) {
    const sorted = [...splits].sort((a, b) => {
      const aRemainder = (a.amountOwed * 100 % 100) / 100
      const bRemainder = (b.amountOwed * 100 % 100) / 100
      return bRemainder - aRemainder
    })
    for (let i = 0; i < remainderCents; i++) {
      sorted[i].amountOwed += 1
    }
  }

  return splits
}

function calculateItemizedSplits(expense: Expense): Split[] {
  const { receiptItems, participantUserIds, taxAmount, tipAmount } = expense
  if (!receiptItems || receiptItems.length === 0) {
    throw new Error('Itemized splits require receipt items')
  }

  const splits: Split[] = participantUserIds.map((userId) => ({
    userId,
    amountOwed: 0,
    originalAmount: 0
  }))

  receiptItems.forEach((item) => {
    const itemSplits = item.assignments.map((assignment) => ({
      userId: assignment.userId,
      amountOwed: item.subtotal,
      originalAmount: item.subtotal
    }))

    splits.forEach((split, i) => {
      const assignment = itemSplits[i]
      if (assignment) {
        split.amountOwed += assignment.amountOwed
        split.originalAmount += assignment.amountOwed
      }
    })
  })

  const taxTipTotal = (taxAmount || 0) + (tipAmount || 0)
  if (taxTipTotal > 0) {
    const itemSubtotals = receiptItems.map(i => i.subtotal)
    const taxTipProportions = itemSubtotals.reduce((sum, subtotal) => sum + subtotal, 0)

    if (taxTipProportions > 0) {
      const additionalSplits: Split[] = participantUserIds.map((userId) => ({
        userId,
        amountOwed: 0,
        originalAmount: 0
      }))

      receiptItems.forEach((item) => {
        const itemProportion = item.subtotal / taxTipProportions
        additionalSplits.forEach((split, i) => {
          const assignment = itemSplits[i]
          if (assignment && itemProportion > 0) {
            const taxTipAmount = Math.floor(taxTipTotal * itemProportion * assignment.amountOwed / item.subtotal)
            split.amountOwed += taxTipAmount
            split.originalAmount += taxTipAmount
          }
        })
      })

      splits.forEach((split, i) => {
        const assignment = itemSplits[i]
        if (assignment) {
          split.amountOwed += assignment.amountOwed
          split.originalAmount += assignment.amountOwed
        }
      })
    }
  }

  return splits
}

function applyDiscounts(
  splits: Split[],
  discounts: GroupMemberDiscount[],
  prorationMethod: DiscountProrationMethod
): Split[] {
  if (discounts.length === 0) {
    return splits
  }

  const participantSet = new Set(participantUserIds)
  const discountEligible = discounts.filter(d => participantSet.has(d.userId))
  if (discountEligible.length === 0) {
    return splits
  }

  const discountCents = discountEligible.reduce((sum, d) => {
    const discountRate = d.type === 'pwd' || d.type === 'senior' ? 0.2 : 0
    const discountedAmount = d.originalAmount * (1 - discountRate)
    return sum + (d.originalAmount - discountedAmount)
  }, 0)

  const prorationAmounts = splits.map(s => {
    const isDiscounted = discountEligible.some(d => d.userId === s.userId)
    const discountRate = isDiscounted ? 0.2 : 0
    const discountedAmount = s.amountOwed * (1 - discountRate)
    return Math.floor(discountedAmount)
  })

  const minimumWeight = 1
  const prorationWeights = prorationAmounts.map(a => Math.max(a, minimumWeight))

  const prorationSplits: Split[] = splits.map((split, i) => {
    const isDiscounted = discountEligible.some(d => d.userId === split.userId)
    const discountRate = isDiscounted ? 0.2 : 0
    const discountApplied = isDiscounted
      ? Math.floor(split.amountOwed * discountRate)
      : 0

    let amountOwed = split.amountOwed - discountApplied
    if (discountCents > 0) {
      const prorationCents = Math.floor(
        discountCents * prorationWeights[i] / prorationWeights.reduce((sum, w) => sum + w, 0)
      )
      amountOwed -= prorationCents
    }

    return {
      ...split,
      amountOwed,
      discountApplied
    }
  })

  return prorationSplits
}

function prorationAppliedCents(proration: Split[]): number {
  return proration.reduce((sum, s) => sum + s.discountApplied, 0)
}

function buildPayerInfo(payerUserIds: number[], payerAmounts: number[], totalAmount: number): Payer[] {
  if (payerAmounts.length !== payerUserIds.length) {
    throw new Error('Payer amounts must match payer user IDs count')
  }

  const payerSum = payerAmounts.reduce((sum, a) => sum + a, 0)
  if (!Number.isInteger(payerSum) || payerSum !== Math.floor(totalAmount)) {
    throw new Error('Payer amounts must sum to total amount')
  }

  return payerUserIds.map((userId, i) => ({
    userId,
    amount: payerAmounts[i]
  }))
}
