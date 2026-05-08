import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(120),
  description: z.string().trim().max(500).optional(),
  currency: z.string().trim().min(1).max(10).default("USD"),
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

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
export type JoinGroupInput = z.infer<typeof JoinGroupSchema>;
export type InviteByEmailInput = z.infer<typeof InviteByEmailSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
