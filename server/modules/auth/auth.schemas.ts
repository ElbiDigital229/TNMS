import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username or email is required").max(255),
  password: z.string().min(1, "Password is required").max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(200, "Password is too long"),
});
