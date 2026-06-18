import { z } from "zod";
import { isCalendarDate } from "../common/datetime";
import { ESPECIALIDADES_TERAPEUTA_SET } from "./especialidades";

export const especialidadesPermitidas = ESPECIALIDADES_TERAPEUTA_SET;

const nullableTrimmed = z.string().trim().max(255).optional().nullable();
// Achado 124: data opcional, mas quando informada exige data de calendario real
// (paridade com requiredDate de pacientes/achado 88). Antes aceitava string livre que o
// service descartava silenciosamente como null (normalizeDateOnlyLoose), perdendo o dado.
const optionalCalendarDate = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value == null || value === "" ? null : value))
    .refine((value) => value == null || isCalendarDate(value), message);

export const profissionaisQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nome: z.string().trim().max(120).optional(),
  cpf: z.string().trim().max(20).optional(),
  especialidade: z.string().trim().max(80).optional(),
  somenteAssistencial: z.coerce.boolean().optional(),
});

export const saveProfissionalSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  cpf: z
    .string()
    .trim()
    .min(1, "CPF invalido.")
    .max(20)
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 11, "CPF invalido."),
  dataNascimento: optionalCalendarDate("Data de nascimento invalida."),
  email: z.string().trim().email().max(120).optional().nullable(),
  telefone: z.string().trim().max(20).optional().nullable(),
  endereco: nullableTrimmed,
  logradouro: z.string().trim().max(180).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  bairro: z.string().trim().max(120).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  cep: z.string().trim().max(12).optional().nullable(),
  especialidade: z.string().trim().min(1).max(80),
  observacao: z.string().trim().max(4000).optional().nullable(),
}).strict();

export type ProfissionaisQueryInput = z.infer<typeof profissionaisQuerySchema>;
export type SaveProfissionalInput = z.infer<typeof saveProfissionalSchema>;

// Backward compatibility aliases.
export const terapeutasQuerySchema = profissionaisQuerySchema;
export const saveTerapeutaSchema = saveProfissionalSchema;
export type TerapeutasQueryInput = ProfissionaisQueryInput;
export type SaveTerapeutaInput = SaveProfissionalInput;
