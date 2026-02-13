import { z } from "zod";

export const createUserSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(8).max(72),
  role: z.string().trim().min(1).max(32),
});

export const updateUserSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  role: z.string().trim().min(1).max(32),
  senha: z.string().min(8).max(72).optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.coerce.number().int().positive()).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
