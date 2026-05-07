import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../utils/errors.js";
import { calculateExpenseDetails } from "./expenses.calculations.js";
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
