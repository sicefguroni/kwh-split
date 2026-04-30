import { z } from "zod";

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/\d/, "Must include a number");

export const SignupFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Too long"),
    email: z.string().trim().email("Enter a valid email"),
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const LoginFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export type SignupFormValues = z.infer<typeof SignupFormSchema>;
export type LoginFormValues = z.infer<typeof LoginFormSchema>;
