import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../utils/errors.js";
import { calculateExpenseDetails, calculateTaxAndTipDistribution } from "./expenses.calculations.js";
import type { ExpenseWriteInput } from "./expenses.schemas.js";

test("applies PWD discount to eligible member only", () => {
  const input: ExpenseWriteInput = {
    groupId: 1,
    titleDescription: "Lunch",
    totalAmount: 100,
    paidByUserId: 1,
    saleDate: "2026-05-08",
    taxAmount: 0,
    tipAmount: 0,
    splitType: "equal",
    participantUserIds: [1, 2],
    memberDiscounts: [{ userId: 1, type: "pwd" }],
  };

  const result = calculateExpenseDetails(input, [1, 2]);
  const byUser = new Map(result.splits.map((split) => [split.userId, split.amountOwed]));

  assert.equal(byUser.get(1), 40);
  assert.equal(byUser.get(2), 60);
  assert.equal(result.memberDiscounts.length, 1);
  assert.equal(result.memberDiscounts[0]?.type, "pwd");
});

test("keeps totals valid when all participants are discounted", () => {
  const input: ExpenseWriteInput = {
    groupId: 1,
    titleDescription: "Dinner",
    totalAmount: 100,
    paidByUserId: 1,
    saleDate: "2026-05-08",
    taxAmount: 0,
    tipAmount: 0,
    splitType: "equal",
    participantUserIds: [1, 2],
    memberDiscounts: [
      { userId: 1, type: "pwd" },
      { userId: 2, type: "senior" },
    ],
  };

  const result = calculateExpenseDetails(input, [1, 2]);
  const total = result.splits.reduce((sum, split) => sum + split.amountOwed, 0);
  assert.equal(total, 100);
});

test("rejects discount user not in participants", () => {
  const input: ExpenseWriteInput = {
    groupId: 1,
    titleDescription: "Snacks",
    totalAmount: 90,
    paidByUserId: 1,
    saleDate: "2026-05-08",
    taxAmount: 0,
    tipAmount: 0,
    splitType: "equal",
    participantUserIds: [1, 2],
    memberDiscounts: [{ userId: 3, type: "pwd" }],
  };

  assert.throws(
    () => calculateExpenseDetails(input, [1, 2, 3]),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_discount_participant",
  );
});
test("equal split distributes total amount across participants", () => {
  const result = calculateExpenseDetails(
    {
      groupId: 1,
      titleDescription: "Dinner",
      totalAmount: 300,
      saleDate: "2026-05-07",
      taxAmount: 0,
      tipAmount: 0,
      splitType: "equal",
      participantUserIds: [1, 2, 3],
    },
    [1, 2, 3],
  );
  assert.equal(result.splits.length, 3);
  assert.equal(
    Number(result.splits.reduce((sum, split) => sum + split.amountOwed, 0).toFixed(2)),
    300,
  );
});

test("percentage split validates percentages and computes allocations", () => {
  const result = calculateExpenseDetails(
    {
      groupId: 1,
      titleDescription: "Lunch",
      totalAmount: 100,
      saleDate: "2026-05-07",
      taxAmount: 0,
      tipAmount: 0,
      splitType: "percentage",
      participantUserIds: [1, 2],
      splits: [
        { userId: 1, percentage: 70 },
        { userId: 2, percentage: 30 },
      ],
    },
    [1, 2],
  );
  const lookup = new Map(result.splits.map((split) => [split.userId, split.amountOwed]));
  assert.equal(lookup.get(1), 70);
  assert.equal(lookup.get(2), 30);
});

test("itemized split allocates tax and tip proportionally", () => {
  const result = calculateExpenseDetails(
    {
      groupId: 1,
      titleDescription: "Restaurant",
      totalAmount: 112,
      saleDate: "2026-05-07",
      taxAmount: 6,
      tipAmount: 6,
      splitType: "itemized",
      participantUserIds: [1, 2],
      receiptItems: [
        { itemName: "Steak", price: 60, assignedUserIds: [1] },
        { itemName: "Pasta", price: 40, assignedUserIds: [2] },
      ],
    },
    [1, 2],
  );
  assert.equal(result.receiptItems.length, 2);
  assert.equal(
    Number(result.splits.reduce((sum, split) => sum + split.amountOwed, 0).toFixed(2)),
    112,
  );
});

test("tax and tip distribution - proportional allocation", () => {
  const result = calculateTaxAndTipDistribution(
    100, // subtotal
    10, // tax
    0, // no tip
    [
      { userId: 1, itemAmount: 70 }, // 70% of bill
      { userId: 2, itemAmount: 30 }, // 30% of bill
    ],
  );

  assert.equal(result.length, 2);

  // User 1 should pay 70% of tax
  const user1Tax = result.find((r) => r.userId === 1)?.taxAndTipAmount || 0;
  assert(user1Tax > 6 && user1Tax < 8, `Expected ~7, got ${user1Tax}`);

  // User 2 should pay 30% of tax
  const user2Tax = result.find((r) => r.userId === 2)?.taxAndTipAmount || 0;
  assert(user2Tax > 2 && user2Tax < 4, `Expected ~3, got ${user2Tax}`);
});

test("tax and tip distribution - equal split", () => {
  const result = calculateTaxAndTipDistribution(
    100, // subtotal
    10, // tax
    10, // tip
    [
      { userId: 1, itemAmount: 50 },
      { userId: 2, itemAmount: 50 },
    ],
  );

  assert.equal(result.length, 2);

  // Each user should pay half the tax and tip
  result.forEach((r) => {
    assert(r.taxAndTipAmount > 9 && r.taxAndTipAmount < 11);
  });
});

test("tax and tip distribution - no loss in rounding", () => {
  const result = calculateTaxAndTipDistribution(
    123.45,
    11.11,
    8.89,
    [
      { userId: 1, itemAmount: 61.73 },
      { userId: 2, itemAmount: 61.72 },
    ],
  );

  const total = result.reduce((sum, r) => sum + r.taxAndTipAmount, 0);
  assert(total > 19.9 && total < 20.1, `Expected ~20, got ${total}`);
});
