import test from "node:test";
import assert from "node:assert/strict";
import { MarkPaidSchema } from "./settlements.schemas.js";

test("mark-paid schema accepts valid settlement payload", () => {
  const parsed = MarkPaidSchema.parse({
    fromUserId: 2,
    toUserId: 1,
    amount: 250.5,
    note: "GCash transfer",
    reference: "TXN-001",
  });
  assert.equal(parsed.fromUserId, 2);
  assert.equal(parsed.toUserId, 1);
  assert.equal(parsed.amount, 250.5);
});

test("mark-paid schema rejects non-positive amount", () => {
  assert.throws(
    () =>
      MarkPaidSchema.parse({
        fromUserId: 2,
        toUserId: 1,
        amount: 0,
      }),
    /Too small/,
  );
});
