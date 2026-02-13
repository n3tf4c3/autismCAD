import { z } from "zod";

export const conveniosPermitidos = new Set([
  "Particular",
  "Unimed",
  "Bradesco",
  "CASSI",
]);

const nullableTrimmed = z.string().trim().max(255).optional().nullable();
const nullableDate = z.string().trim().optional().nullable();

export const pacientesQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nome: z.string().trim().max(120).optional(),
  cpf: z.string().trim().max(20).optional(),
});

export const savePacienteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  cpf: z.string().trim().min(11).max(20),
  nascimento: nullableDate,
  convenio: z.string().trim().optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  nomeResponsavel: nullableTrimmed,
  telefone: z.string().trim().max(20).optional().nullable(),
  telefone2: z.string().trim().max(20).optional().nullable(),
  nomeMae: nullableTrimmed,
  nomePai: nullableTrimmed,
  sexo: z.string().trim().max(20).optional().nullable(),
  dataInicio: nullableDate,
  fotoAtual: z.string().trim().max(255).optional().nullable(),
  laudoAtual: z.string().trim().max(255).optional().nullable(),
  documentoAtual: z.string().trim().max(255).optional().nullable(),
  ativo: z.union([z.string(), z.number(), z.boolean()]).optional().nullable(),
  terapias: z.array(z.string().trim().min(1).max(40)).optional().default([]),
  terapia: z
    .union([z.string().trim().min(1).max(40), z.array(z.string().trim().min(1).max(40))])
    .optional(),
});

export type PacientesQueryInput = z.infer<typeof pacientesQuerySchema>;
export type SavePacienteInput = z.infer<typeof savePacienteSchema>;
