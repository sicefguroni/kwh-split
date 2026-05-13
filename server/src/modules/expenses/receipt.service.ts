import { pool } from "../../db/pool.js";
import type { ReceiptAssignmentInput } from "./receipt.schemas.js";
import { OCRService } from "../common/ocr.service.js";
import { badRequest } from "../../utils/errors.js";
import type { CalculatedSplit } from "./expenses.calculations.js";
import { calculateTaxAndTipDistribution } from "./expenses.calculations.js";

export interface ReceiptItemWithAssignments {
  itemId: number;
  itemName: string;
  price: number;
  assignedUserIds: number[];
  rawText: string;
  ocrConfidence: number | undefined;
}

export const receiptService = {
  ocrService: new OCRService(),

  async processReceiptImage(expenseId: number, imageBuffer: Buffer): Promise<ReceiptItemWithAssignments[]> {
    const ocrResult = await this.ocrService.extractReceiptItems(imageBuffer);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify expense exists
      const expenseResult = await client.query(
        "SELECT expense_id FROM expenses WHERE expense_id = $1",
        [expenseId],
      );
      
      if (expenseResult.rows.length === 0) {
        throw badRequest("Expense not found", "expense_not_found");
      }

      // Delete existing items for the expense and their assignments.
      await client.query("DELETE FROM receipt_items WHERE expense_id = $1", [expenseId]);

      // Insert newly extracted items and keep the OCR text that produced each row.
      for (const item of ocrResult.items) {
        await client.query(
          `INSERT INTO receipt_items (
            expense_id,
            item_name,
            price,
            ocr_confidence,
            raw_ocr_text,
            is_extracted_by_ocr
          )
           VALUES ($1, $2, $3::numeric(10,2), $4::numeric(5,2), $5, TRUE)`,
          [expenseId, item.name, item.price, item.confidence, item.rawText],
        );
      }
      
      // Update receipt flag in expense.
      await client.query(
        "UPDATE expenses SET receipt_items_flag = $2, updated_at = CURRENT_TIMESTAMP WHERE expense_id = $1",
        [expenseId, ocrResult.items.length > 0],
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return this.getReceiptItemsForExpense(expenseId);
  },

  async assignReceiptItems(
    expenseId: number,
    input: ReceiptAssignmentInput,
  ): Promise<CalculatedSplit[]> {
    // Get expense details
    const expenseResult = await pool.query(
      `SELECT tax_amount, tip_amount FROM expenses WHERE expense_id = $1`,
      [expenseId],
    );

    if (expenseResult.rows.length === 0) {
      throw badRequest("Expense not found", "expense_not_found");
    }

    const { tax_amount, tip_amount } = expenseResult.rows[0];

    // Clear existing assignments for this expense
    await pool.query(
      `DELETE FROM receipt_item_assignments 
       WHERE item_id IN (
         SELECT item_id FROM receipt_items WHERE expense_id = $1
       )`,
      [expenseId],
    );

    // Insert new assignments and collect items
    const items: ReceiptItemWithAssignments[] = [];
    for (const assignment of input.assignments) {
      // Verify item belongs to this expense
      const itemResult = await pool.query(
        `SELECT item_id, item_name, price, raw_ocr_text, ocr_confidence FROM receipt_items 
         WHERE item_id = $1 AND expense_id = $2`,
        [assignment.itemId, expenseId],
      );

      if (itemResult.rows.length === 0) {
        throw badRequest("Receipt item not found", "item_not_found");
      }

      const item = itemResult.rows[0];
      items.push({
        itemId: item.item_id,
        itemName: item.item_name,
        price: parseFloat(item.price),
        assignedUserIds: assignment.assignedUserIds,
        rawText: item.raw_ocr_text ?? "",
        ocrConfidence:
          item.ocr_confidence !== null && item.ocr_confidence !== undefined
            ? parseFloat(item.ocr_confidence)
            : undefined,
      });

      // Insert assignments
      for (const userId of assignment.assignedUserIds) {
        await pool.query(
          `INSERT INTO receipt_item_assignments (item_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (item_id, user_id) DO NOTHING`,
          [assignment.itemId, userId],
        );
      }
    }

    // Calculate splits based on assignments and tax/tip distribution
    return calculateSplitsFromAssignments(
      items,
      parseFloat(tax_amount),
      parseFloat(tip_amount),
    );
  },

  async getReceiptItemsForExpense(expenseId: number): Promise<ReceiptItemWithAssignments[]> {
    const result = await pool.query(
      `SELECT 
        ri.item_id,
        ri.item_name,
        ri.price,
        COALESCE(ri.raw_ocr_text, '') AS raw_ocr_text,
        ri.ocr_confidence,
        COALESCE(array_agg(DISTINCT ria.user_id) FILTER (WHERE ria.user_id IS NOT NULL), ARRAY[]::int[]) as assigned_user_ids
       FROM receipt_items ri
       LEFT JOIN receipt_item_assignments ria ON ri.item_id = ria.item_id
       WHERE ri.expense_id = $1
       GROUP BY ri.item_id, ri.item_name, ri.price, ri.raw_ocr_text, ri.ocr_confidence
       ORDER BY ri.item_id`,
      [expenseId],
    );

    return result.rows.map((row) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      price: parseFloat(row.price),
      assignedUserIds: row.assigned_user_ids || [],
      rawText: row.raw_ocr_text ?? "",
      ocrConfidence:
        row.ocr_confidence !== null && row.ocr_confidence !== undefined
          ? parseFloat(row.ocr_confidence)
          : undefined,
    }));
  },

  async extractReceiptPreview(imageBuffer: Buffer) {
    const ocrResult = await this.ocrService.extractReceiptItems(imageBuffer);
    return ocrResult.items;
  },
};

function calculateSplitsFromAssignments(
  items: ReceiptItemWithAssignments[],
  taxAmount: number,
  tipAmount: number,
): CalculatedSplit[] {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const splits: Map<number, number> = new Map();

  // First pass: calculate item amounts
  for (const item of items) {
    for (const userId of item.assignedUserIds) {
      const amountPerUser = item.price / item.assignedUserIds.length;
      const current = splits.get(userId) || 0;
      splits.set(userId, current + amountPerUser);
    }
  }

  // Second pass: distribute tax and tip proportionally
  const taxAndTipDistribution = calculateTaxAndTipDistribution(
    subtotal,
    taxAmount,
    tipAmount,
    Array.from(splits.entries()).map(([userId, amount]) => ({
      userId,
      itemAmount: amount,
    })),
  );

  // Combine item amounts with tax/tip
  const finalSplits: CalculatedSplit[] = [];
  for (const [userId, itemAmount] of splits.entries()) {
    const taxTipForUser = taxAndTipDistribution.find((t) => t.userId === userId);
    const totalOwed = itemAmount + (taxTipForUser?.taxAndTipAmount || 0);

    finalSplits.push({
      userId,
      amountOwed: totalOwed,
      percentage: null,
      share: null,
    });
  }

  return finalSplits;
}
