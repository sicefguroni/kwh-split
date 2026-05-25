import { describe, it } from "node:test";
import assert from "node:assert";
import { cleanItemName, isSummaryLine } from "./ocr.service.js";

describe("cleanItemName", () => {
  it("should clean basic item names", () => {
    assert.strictEqual(cleanItemName("Burger"), "Burger");
  });

  it("should remove leading quantities", () => {
    assert.strictEqual(cleanItemName("2x Pasta Carbonara"), "Pasta Carbonara");
    assert.strictEqual(cleanItemName("3 x Fries"), "Fries");
  });

  it("should remove leading bullet/dash markers", () => {
    assert.strictEqual(cleanItemName("- Item"), "Item");
    assert.strictEqual(cleanItemName("• Item"), "Item");
  });

  it("should remove trailing price fragments", () => {
    assert.strictEqual(cleanItemName("Item 12.99"), "Item");
  });

  it("should collapse multiple spaces", () => {
    assert.strictEqual(cleanItemName("Item    Name"), "Item Name");
  });
});

describe("isSummaryLine", () => {
  it("should identify total lines", () => {
    assert.strictEqual(isSummaryLine("Total"), true);
    assert.strictEqual(isSummaryLine("Grand Total"), true);
  });

  it("should identify tax lines", () => {
    assert.strictEqual(isSummaryLine("Tax"), true);
    assert.strictEqual(isSummaryLine("Sales Tax"), true);
  });

  it("should identify tip lines", () => {
    assert.strictEqual(isSummaryLine("Tip"), true);
    assert.strictEqual(isSummaryLine("Gratuity"), true);
  });

  it("should identify subtotal lines", () => {
    assert.strictEqual(isSummaryLine("Subtotal"), true);
  });

  it("should not flag item lines", () => {
    assert.strictEqual(isSummaryLine("Burger"), false);
    assert.strictEqual(isSummaryLine("Coffee"), false);
    assert.strictEqual(isSummaryLine("Cake"), false);
  });
});
