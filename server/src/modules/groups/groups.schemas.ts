import { z } from "zod";

const GroupImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000_000)
  .refine(
    (value) => value.startsWith("data:image/") || z.string().url().safeParse(value).success,
    "Group cover must be a valid image URL or data URL",
  );

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(120),
  description: z.string().trim().max(500).optional(),
  currency: z.string().trim().min(1).max(10).default("USD"),
  imageUrl: GroupImageUrlSchema.optional(),
});
export const UpdateGroupSchema = CreateGroupSchema;

export const JoinGroupSchema = z.object({
  userId: z.coerce.number().int().positive("userId must be a positive integer").optional(),
  userName: z.string().trim().min(1, "userName is required").max(80).optional(),
}).refine((value) => value.userId !== undefined || value.userName !== undefined, {
  message: "Either userId or userName is required",
  path: ["userId"],
});

export const InviteByEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const InviteRecipientSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address").optional(),
    userId: z.coerce.number().int().positive("userId must be a positive integer").optional(),
  })
  .refine((value) => value.email !== undefined || value.userId !== undefined, {
    message: "Each recipient needs an email or userId",
    path: ["email"],
  });

export const CreateInvitationsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address").optional(),
    recipients: z.array(InviteRecipientSchema).min(1).max(20).optional(),
  })
  .refine((value) => value.email !== undefined || value.recipients !== undefined, {
    message: "At least one recipient is required",
    path: ["recipients"],
  })
  .transform((value) => ({
    recipients:
      value.recipients ??
      (value.email
        ? [
            {
              email: value.email,
            },
          ]
        : []),
  }));

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
export type JoinGroupInput = z.infer<typeof JoinGroupSchema>;
export type CreateInvitationsInput = z.infer<typeof CreateInvitationsSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
