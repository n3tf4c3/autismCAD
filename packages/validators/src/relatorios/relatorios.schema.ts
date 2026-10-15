import { z } from "zod";
import { isCalendarDate } from "../common/datetime";
import { ESPECIALIDADES_RELATORIO_PLANO_ENSINO } from "./especialidades";

const optionalProfissionalId = z.coerce.number().int().positive().optional();

// Achado 109: filtros de data so passam se forem data de calendario real (ou vazio).
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isCalendarDate(value), "Data invalida. Use AAAA-MM-DD valido")
  .optional();

export const evolutivoQuerySchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    from: optionalDate,
    to: optionalDate,
    profissionalId: optionalProfissionalId,
  });

export type EvolutivoQueryInput = z.infer<typeof evolutivoQuerySchema>;

export const planoEnsinoQuerySchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    from: optionalDate,
    to: optionalDate,
    especialidade: z.enum(ESPECIALIDADES_RELATORIO_PLANO_ENSINO).optional(),
  });

export type PlanoEnsinoQueryInput = z.infer<typeof planoEnsinoQuerySchema>;

export const assiduidadeQuerySchema = z
  .object({
    pacienteNome: z.string().trim().optional(),
    profissionalId: optionalProfissionalId,
    from: optionalDate,
    to: optionalDate,
    presenca: z.enum(["Presente", "Ausente", "Feriado", "Recesso", "Nao informado"]).optional(),
  });

export type AssiduidadeQueryInput = z.infer<typeof assiduidadeQuerySchema>;
