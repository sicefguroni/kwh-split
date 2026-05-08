import { z } from "zod";

export const MarkPaidSchema = z.object({
  fromUserId: z.coerce.number().int().positive(),
  toUserId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  note: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
});

export type MarkPaidInput = z.infer<typeof MarkPaidSchema>;
