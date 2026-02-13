import { z } from "zod";

export const evolutivoQuerySchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  terapeutaId: z.coerce.number().int().positive().optional(),
});

export type EvolutivoQueryInput = z.infer<typeof evolutivoQuerySchema>;

