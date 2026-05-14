import { z } from "zod";

export const SplitTypeSchema = z.enum(["equal", "percentage", "shares", "exact", "itemized"]);

export const SplitEntrySchema = z.object({
  userId: z.coerce.number().int().positive(),
  percentage: z.coerce.number().positive().optional(),
  share: z.coerce.number().positive().optional(),
  amount: z.coerce.number().positive().optional(),
});

export const MemberDiscountTypeSchema = z.enum(["none", "pwd", "senior"]);

export const MemberDiscountSchema = z.object({
  userId: z.coerce.number().int().positive(),
  type: MemberDiscountTypeSchema,
});

export const ReceiptItemSchema = z.object({
  itemName: z.string().trim().min(1).max(255),
  price: z.coerce.number().positive(),
  assignedUserIds: z.array(z.coerce.number().int().positive()).default([]),
});

export const ExpenseWriteSchema = z.object({
  groupId: z.coerce.number().int().positive(),
  titleDescription: z.string().trim().min(1).max(255),
  totalAmount: z.coerce.number().positive(),
  paidByUserId: z.coerce.number().int().positive().optional(),
  saleDate: z.string().date(),
  taxAmount: z.coerce.number().min(0).default(0),
  tipAmount: z.coerce.number().min(0).default(0),
  splitType: SplitTypeSchema.default("equal"),
  category: z.string().trim().max(100).optional(),
  note: z.string().trim().max(2000).optional(),
  participantUserIds: z.array(z.coerce.number().int().positive()).optional(),
  splits: z.array(SplitEntrySchema).optional(),
  receiptItems: z.array(ReceiptItemSchema).optional(),
  memberDiscounts: z.array(MemberDiscountSchema).optional(),
}).superRefine((value, ctx) => {
  if (!value.memberDiscounts?.length) return;
  const seen = new Set<number>();
  for (const discount of value.memberDiscounts) {
    if (seen.has(discount.userId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "memberDiscounts must not contain duplicate userId entries",
        path: ["memberDiscounts"],
      });
      return;
    }
    seen.add(discount.userId);
  }
});

export const UpdateExpenseSchema = ExpenseWriteSchema;

export const MarkPaidSchema = z.object({
  fromUserId: z.coerce.number().int().positive(),
  toUserId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  note: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
});

export type ExpenseWriteInput = z.infer<typeof ExpenseWriteSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
export type MemberDiscountType = z.infer<typeof MemberDiscountTypeSchema>;
