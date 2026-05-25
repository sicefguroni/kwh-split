import test from "node:test";
import assert from "node:assert/strict";
import { computeSettlementPlan, type SettlementPlanEntry } from "./settlements.service.js";

/**
 * Helper: assert plan matches expected transactions (order-independent).
 */
function assertPlanMatches(
  actual: SettlementPlanEntry[],
  expected: SettlementPlanEntry[],
) {
  assert.equal(
    actual.length,
    expected.length,
    `Expected ${expected.length} transactions, got ${actual.length}: ${JSON.stringify(actual)}`,
  );

  for (const exp of expected) {
    const match = actual.find(
      (a) =>
        a.fromUserId === exp.fromUserId &&
        a.toUserId === exp.toUserId &&
        Math.abs(a.amount - exp.amount) < 0.001,
    );
    if (!match) {
      assert.fail(
        `Expected transaction missing: from ${exp.fromUserId} → ${exp.toUserId} = ${exp.amount}. Actual: ${JSON.stringify(actual)}`,
      );
    }
  }
}

test("computeSettlementPlan: empty balances returns empty plan", () => {
  const result = computeSettlementPlan([]);
  assert.deepEqual(result, []);
});

test("computeSettlementPlan: all zero balances returns empty plan", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 0 },
    { userId: 2, netBalance: 0 },
    { userId: 3, netBalance: 0 },
  ]);
  assert.deepEqual(result, []);
});

test("computeSettlementPlan: below-threshold balances treated as zero", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 0.004 },
    { userId: 2, netBalance: -0.004 },
  ]);
  assert.deepEqual(result, [], "0.004 is below 0.005 threshold");
});

test("computeSettlementPlan: single debtor, single creditor", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -50 },
    { userId: 2, netBalance: 50 },
  ]);
  assertPlanMatches(result, [
    { fromUserId: 1, toUserId: 2, amount: 50 },
  ]);
});

test("computeSettlementPlan: single debtor owes multiple creditors", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -100 },
    { userId: 2, netBalance: 70 },
    { userId: 3, netBalance: 30 },
  ]);
  assertPlanMatches(result, [
    { fromUserId: 1, toUserId: 2, amount: 70 },
    { fromUserId: 1, toUserId: 3, amount: 30 },
  ]);
});

test("computeSettlementPlan: multiple debtors pay single creditor", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -30 },
    { userId: 2, netBalance: -70 },
    { userId: 3, netBalance: 100 },
  ]);
  assertPlanMatches(result, [
    { fromUserId: 2, toUserId: 3, amount: 70 },
    { fromUserId: 1, toUserId: 3, amount: 30 },
  ]);
});

test("computeSettlementPlan: optimal min-transaction (N-1 for N participants)", () => {
  // 4 people with non-zero balance → should produce at most 3 transactions
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -40 },
    { userId: 2, netBalance: -10 },
    { userId: 3, netBalance: 25 },
    { userId: 4, netBalance: 25 },
  ]);
  assert.ok(result.length <= 3, `Expected ≤3 transactions, got ${result.length}`);
  // Verify total inflow = total outflow
  const totalSent = result.reduce((s, e) => s + e.amount, 0);
  assert.equal(totalSent, 50);
});

test("computeSettlementPlan: cancels out when amounts equal", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -50 },
    { userId: 2, netBalance: 50 },
    { userId: 3, netBalance: 0 },
  ]);
  // Only 1 and 2 need to transact; 3 is net zero
  assertPlanMatches(result, [
    { fromUserId: 1, toUserId: 2, amount: 50 },
  ]);
});

test("computeSettlementPlan: handles floating-point amounts cleanly", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -33.33 },
    { userId: 2, netBalance: 33.33 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.amount, 33.33);
});

test("computeSettlementPlan: complex multi-way", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 0 },
    { userId: 2, netBalance: -100.25 },
    { userId: 3, netBalance: 150.75 },
    { userId: 4, netBalance: -50.50 },
  ]);
  // Total creditor: 150.75 (user 3)
  // Total debtor: 100.25 (user 2) + 50.50 (user 4) = 150.75
  // Greedy: largest debtor (2, owes 100.25) pays largest creditor (3, owed 150.75)
  //   → 100.25, creditor 3 remaining = 50.50
  // Next debtor (4, owes 50.50) pays creditor 3 remaining 50.50
  assertPlanMatches(result, [
    { fromUserId: 2, toUserId: 3, amount: 100.25 },
    { fromUserId: 4, toUserId: 3, amount: 50.50 },
  ]);
});

test("computeSettlementPlan: no transactions when everyone owes zero", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 0.001 },
    { userId: 2, netBalance: -0.001 },
  ]);
  assert.deepEqual(result, []);
});

test("computeSettlementPlan: rounding does not create phantom transactions", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 0.0049 },
    { userId: 2, netBalance: -0.0049 },
  ]);
  assert.deepEqual(result, []);
});

test("computeSettlementPlan: multiple payers produce correct per-person settlements", () => {
  // Bob pays 350, Mary pays 150, Julie pays 0. Total=500. Each owes 166.67.
  // Net: Bob=+183.33 (creditor), Mary=-16.67 (debtor), Julie=-166.67 (debtor)
  // Greedy: Julie (biggest debtor, 166.67) pays Bob (biggest creditor, 183.33) → 166.67
  // Bob remaining: 183.33 - 166.67 = 16.66
  // Mary (16.67) pays Bob (16.66) → 16.66 (min of both)
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 183.33 },
    { userId: 2, netBalance: -16.67 },
    { userId: 3, netBalance: -166.67 },
  ]);
  assertPlanMatches(result, [
    { fromUserId: 3, toUserId: 1, amount: 166.67 },
    { fromUserId: 2, toUserId: 1, amount: 16.66 },
  ]);
  const totalSent = result.reduce((s, e) => s + e.amount, 0);
  assert.equal(Math.round(totalSent * 100) / 100, 183.33);
});

test("computeSettlementPlan: each debtor must settle exact amount owed to each creditor", () => {
  // Bob owes Mary 150, Bob owes Julie 150.
  // Mary MUST NOT settle Bob's 300 — she can only settle 150.
  // Net: Mary=+150 (creditor), Julie=+150 (creditor), Bob=-300 (debtor)
  const result = computeSettlementPlan([
    { userId: 1, netBalance: 150 },
    { userId: 2, netBalance: 150 },
    { userId: 3, netBalance: -300 },
  ]);
  assertPlanMatches(result, [
    { fromUserId: 3, toUserId: 1, amount: 150 },
    { fromUserId: 3, toUserId: 2, amount: 150 },
  ]);
});

test("computeSettlementPlan: large amounts don't overflow or lose precision", () => {
  const result = computeSettlementPlan([
    { userId: 1, netBalance: -100000.00 },
    { userId: 2, netBalance: 50000.00 },
    { userId: 3, netBalance: 50000.00 },
  ]);
  assertPlanMatches(result, [
    { fromUserId: 1, toUserId: 2, amount: 50000.00 },
    { fromUserId: 1, toUserId: 3, amount: 50000.00 },
  ]);
});
