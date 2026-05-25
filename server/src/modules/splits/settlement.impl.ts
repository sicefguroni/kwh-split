import type { CoverageEntry, NetSettlement, SettlementEvent } from "./settlement";

export function computeNetSettlements(
  splits: Split[],
  coverageEntries: CoverageEntry[],
): NetSettlement[] {
  const coverageMap = new Map<number, CoverageEntry[]>();

  coverageEntries.forEach((entry) => {
    if (!coverageMap.has(entry.payerUserId)) {
      coverageMap.set(entry.payerUserId, []);
    }
    coverageMap.get(entry.payerUserId)!.push(entry);
  });

  const netSettlements: Map<number, number> = new Map();
  splits.forEach((split) => {
    netSettlements.set(split.userId, split.amountOwed);
  });

  coverageMap.forEach((payerCoverage) => {
    payerCoverage.forEach((entry) => {
      if (netSettlements.has(entry.payerUserId) && netSettlements.has(entry.coveredUserId)) {
        const payerVal = netSettlements.get(entry.payerUserId)!;
        netSettlements.set(entry.payerUserId, payerVal - entry.amountCovered);
        const coveredVal = netSettlements.get(entry.coveredUserId)!;
        netSettlements.set(entry.coveredUserId, coveredVal + entry.amountCovered);
      }
    });
  });

  return Array.from(netSettlements.entries())
    .map(([userId, netAmount]) => ({
      userId,
      netAmount,
      coverageSettled: coverageMap
        .get(userId)
        ?.reduce((sum, c) => sum + c.amountCovered, 0),
    }))
    .sort((a, b) => b.netAmount - a.netAmount);
}

export function generateSettlements(
  splits: Split[],
  coverageEntries: CoverageEntry[],
): SettlementEvent[] {
  const coverageMap = new Map<number, CoverageEntry[]>();

  coverageEntries.forEach((entry) => {
    if (!coverageMap.has(entry.payerUserId)) {
      coverageMap.set(entry.payerUserId, []);
    }
    coverageMap.get(entry.payerUserId)!.push(entry);
  });

  const netSettlements = computeNetSettlements(splits, coverageEntries);
  const settlements: SettlementEvent[] = [];

  netSettlements.forEach((settlement) => {
    if (settlement.netAmount <= 0) {
      return;
    }

    const unsettledCoverage = coverageMap
      .get(settlement.userId)
      ?.filter((c) => !c.isSettled);

    if (unsettledCoverage?.length > 0) {
      unsettledCoverage.forEach((coverage, i) => {
        settlements.push({
          id: Date.now() + i,
          expenseId: coverage.expenseId,
          fromUserId: settlement.userId,
          toUserId: coverage.coveredUserId,
          amount: coverage.amountCovered,
          isSettled: false,
          createdAt: new Date(),
        });
      });
    } else {
      settlements.push({
        id: Date.now(),
        expenseId: splits[0]?.expenseId || 0,
        fromUserId: settlement.userId,
        toUserId: null,
        amount: settlement.netAmount,
        isSettled: false,
        createdAt: new Date(),
      });
    }
  });

  return settlements;
}

export function minimizeTransactions(
  netSettlements: NetSettlement[],
  coverageEntries: CoverageEntry[],
): { userId: number; toUserId: number | null; amount: number }[] {
  const coverageMap = new Map<number, CoverageEntry[]>();

  coverageEntries.forEach((entry) => {
    if (!coverageMap.has(entry.payerUserId)) {
      coverageMap.set(entry.payerUserId, []);
    }
    coverageMap.get(entry.payerUserId)!.push(entry);
  });

  const transactions: { userId: number; toUserId: number | null; amount: number }[] = [];
  const settledCoverage = new Set<number>();

  while (netSettlements.length > 0) {
    const mostNegative = netSettlements.shift()!;

    if (mostNegative.netAmount <= 0) {
      continue;
    }

    const unsettledCoverage = coverageMap
      .get(mostNegative.userId)
      ?.filter((c) => !c.isSettled);

    if (unsettledCoverage?.length > 0) {
      unsettledCoverage.forEach((coverage) => {
        transactions.push({
          userId: mostNegative.userId,
          toUserId: coverage.coveredUserId,
          amount: Math.min(mostNegative.netAmount, coverage.amountCovered),
        });

        mostNegative.netAmount -= coverage.amountCovered;
        settledCoverage.add(coverage.id);

        if (mostNegative.netAmount <= 0) {
          break;
        }
      });

      if (mostNegative.netAmount > 0) {
        netSettlements.unshift(mostNegative);
        continue;
      }
    }

    transactions.push({
      userId: mostNegative.userId,
      toUserId: null,
      amount: mostNegative.netAmount,
    });
  }

  return transactions;
}
