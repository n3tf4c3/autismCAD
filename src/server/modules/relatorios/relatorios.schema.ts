import { z } from "zod";

const optionalProfissionalId = z.coerce.number().int().positive().optional();

export const evolutivoQuerySchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    profissionalId: optionalProfissionalId,
  });

export type EvolutivoQueryInput = z.infer<typeof evolutivoQuerySchema>;

export const planoEnsinoQuerySchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
  });

export type PlanoEnsinoQueryInput = z.infer<typeof planoEnsinoQuerySchema>;

export const assiduidadeQuerySchema = z
  .object({
    pacienteNome: z.string().trim().optional(),
    profissionalId: optionalProfissionalId,
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    presenca: z.enum(["Presente", "Ausente", "Nao informado"]).optional(),
  });

export type AssiduidadeQueryInput = z.infer<typeof assiduidadeQuerySchema>;
