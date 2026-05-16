import { z } from "zod";

export const ReceiptItemResponseSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string(),
  price: z.number().positive(),
  assignedUserIds: z.array(z.number().int().positive()),
  rawText: z.string(),
  ocrConfidence: z.number().min(0).max(100).optional(),
});

export const ReceiptUploadResponseSchema = z.object({
  success: z.boolean(),
  items: z.array(ReceiptItemResponseSchema),
});

export const ReceiptSplitSchema = z.object({
  userId: z.number().int().positive(),
  amountOwed: z.number(),
  percentage: z.number().nullable(),
  share: z.number().nullable(),
});

export const ReceiptAssignmentResponseSchema = z.object({
  success: z.boolean(),
  splits: z.array(ReceiptSplitSchema),
});

export const ItemAssignmentSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  assignedUserIds: z.array(z.coerce.number().int().positive()).min(1),
});

export const ReceiptAssignmentInputSchema = z.object({
  assignments: z.array(ItemAssignmentSchema),
});

export type ReceiptAssignmentInput = z.infer<typeof ReceiptAssignmentInputSchema>;
