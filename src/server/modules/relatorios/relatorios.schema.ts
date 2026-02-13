import { z } from "zod";

export const evolutivoQuerySchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  terapeutaId: z.coerce.number().int().positive().optional(),
});

export type EvolutivoQueryInput = z.infer<typeof evolutivoQuerySchema>;

export const assiduidadeQuerySchema = z.object({
  pacienteNome: z.string().trim().optional(),
  terapeutaId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  presenca: z.enum(["Presente", "Ausente", "Nao informado"]).optional(),
});

export type AssiduidadeQueryInput = z.infer<typeof assiduidadeQuerySchema>;

export const clinicoQuerySchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  terapeutaId: z.coerce.number().int().positive().optional(),
});

export type ClinicoQueryInput = z.infer<typeof clinicoQuerySchema>;
