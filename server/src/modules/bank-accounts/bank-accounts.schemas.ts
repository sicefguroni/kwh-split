import { z } from "zod";

export const CreateBankAccountSchema = z.object({
  bankName: z.string().trim().min(1).max(255),
  accountNumber: z.string().trim().min(1).max(100),
});

export type CreateBankAccountInput = z.infer<typeof CreateBankAccountSchema>;
