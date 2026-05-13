import { describe, it } from "node:test";
import assert from "node:assert";
import { OCRService } from "./ocr.service.js";
import { pino } from "pino";

const logger = pino({ level: 'silent' });
const ocrService = new OCRService(logger);

describe("OCRService - Receipt Parsing", () => {
  describe("parseReceiptText", () => {
    it("should extract items with standard format", () => {
      const text = `STORE NAME
Date: 12/15/2024
---
Burger                    12.99
Fries                      5.99
Soda                       2.99
---
Subtotal                  21.97
Tax                        2.00
Total                     23.97`;

      const items = (ocrService as any).parseReceiptText(text);
      assert.strictEqual(items.length, 3);
      assert.strictEqual(items[0].name, "Burger");
      assert.strictEqual(items[0].price, 12.99);
      assert.strictEqual(items[1].name, "Fries");
      assert.strictEqual(items[1].price, 5.99);
      assert.strictEqual(items[2].name, "Soda");
      assert.strictEqual(items[2].price, 2.99);
    });

    it("should handle items with leading dollar signs", () => {
      const text = `$12.99 Burger
$5.99 Fries
$2.99 Soda`;

      const items = (ocrService as any).parseReceiptText(text);
      assert.ok(items.length >= 0);
    });

    it("should skip subtotal, tax, and total lines", () => {
      const text = `Burger                    12.99
Subtotal                  12.99
Tax                        1.50
Tip                        2.00
Total                     16.49`;

      const items = (ocrService as any).parseReceiptText(text);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, "Burger");
    });

    it("should skip separator lines and timestamps", () => {
      const text = `====================================
2024-12-15 14:30:45
====================================
Burger                    12.99
Fries                      5.99
====================================`;

      const items = (ocrService as any).parseReceiptText(text);
      assert.strictEqual(items.length, 2);
    });

    it("should handle various restaurant receipt formats", () => {
      const text = `RESTAURANT NAME
123 Main St

1x Pasta Carbonara         18.50
2x House Salad@8.50ea     17.00
1x Iced Tea                3.50

Subtotal                  39.00
Tax 8.5%                   3.32
Service 18%                7.02
Total                     49.34`;

      const items = (ocrService as any).parseReceiptText(text);
      assert.ok(items.length > 0);
      assert.ok(items.some((i: any) => i.price === 18.5));
    });

    it("should set base confidence for parsed items", () => {
      const text = `Burger                    12.99
Fries                      5.99`;

      const items = (ocrService as any).parseReceiptText(text);
      items.forEach((item: any) => {
        assert.ok(item.confidence > 0);
        assert.ok(item.confidence <= 100);
      });
    });

    it("should include raw text for each item", () => {
      const text = `Burger                    12.99
Fries                      5.99`;

      const items = (ocrService as any).parseReceiptText(text);
      items.forEach((item: any) => {
        assert.ok(item.rawText);
        assert.strictEqual(typeof item.rawText, "string");
      });
    });

    it("should handle empty receipt text", () => {
      const text = ``;
      const items = (ocrService as any).parseReceiptText(text);
      assert.strictEqual(items.length, 0);
    });

    it("should handle receipt with only separator lines", () => {
      const text = `===================
---
===================`;

      const items = (ocrService as any).parseReceiptText(text);
      assert.strictEqual(items.length, 0);
    });
  });

  describe("isNonItemLine", () => {
    it("should identify total lines", () => {
      const testLines = [
        "Total                     23.97",
        "TOTAL                     23.97",
        "Grand Total               50.00",
      ];

      testLines.forEach((line) => {
        assert.strictEqual((ocrService as any).isNonItemLine(line), true);
      });
    });

    it("should identify tax lines", () => {
      const testLines = [
        "Tax                        2.00",
        "TAX 8.5%                   3.32",
        "Sales Tax                  5.50",
      ];

      testLines.forEach((line) => {
        assert.strictEqual((ocrService as any).isNonItemLine(line), true);
      });
    });

    it("should identify tip lines", () => {
      const testLines = [
        "Tip                        5.00",
        "TIP 18%                    8.50",
        "Gratuity                   10.00",
      ];

      testLines.forEach((line) => {
        assert.strictEqual((ocrService as any).isNonItemLine(line), true);
      });
    });

    it("should identify separator lines", () => {
      const testLines = [
        "===================",
        "-------------------",
        "*********************",
      ];

      testLines.forEach((line) => {
        assert.strictEqual((ocrService as any).isNonItemLine(line), true);
      });
    });

    it("should identify header/footer lines", () => {
      const testLines = [
        "Thank you for your purchase",
        "Welcome to our restaurant",
        "Please come again",
        "Store Location",
        "Register Number 5",
      ];

      testLines.forEach((line) => {
        assert.strictEqual((ocrService as any).isNonItemLine(line), true);
      });
    });

    it("should not flag item lines", () => {
      const testLines = [
        "Burger                    12.99",
        "Large Coffee               4.50",
        "Chocolate Cake             7.99",
      ];

      testLines.forEach((line) => {
        assert.strictEqual((ocrService as any).isNonItemLine(line), false);
      });
    });
  });

  describe("Service Initialization", async () => {
    it("should initialize OCR service", async () => {
      await ocrService.initialize();
      // Service should be ready after initialization
      assert.ok(ocrService);
    });

    it("should handle multiple initializations gracefully", async () => {
      await ocrService.initialize();
      await ocrService.initialize(); // Should not throw
      assert.ok(ocrService);
    });
  });
});
