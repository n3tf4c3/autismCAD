import { z } from "zod";
import { AppError } from "@/server/shared/errors";

export const patchAtivoSchema = z.object({
  ativo: z.union([z.boolean(), z.number(), z.string()]),
});

export type PatchAtivoInput = z.infer<typeof patchAtivoSchema>;

export function parseAtivo(value: boolean | number | string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const parsed = value.trim().toLowerCase();
  if (["1", "true", "ativo"].includes(parsed)) return true;
  if (["0", "false", "inativo", "arquivado"].includes(parsed)) return false;
  throw new AppError("Campo ativo invalido", 400, "INVALID_INPUT");
}
