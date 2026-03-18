import { z } from "zod";

export const conveniosPermitidos = new Set([
  "Particular",
  "Unimed",
  "Bradesco",
  "CASSI",
]);

const nullableTrimmed = z.string().trim().max(255).optional().nullable();
const requiredDate = (message: string) => z.string().trim().min(1, message);

export const pacientesQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nome: z.string().trim().max(120).optional(),
  cpf: z.string().trim().max(20).optional(),
});

export const savePacienteSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do paciente.").max(120),
  cpf: z
    .string()
    .trim()
    .min(1, "CPF invalido.")
    .max(20)
    .refine((value) => value.replace(/\D/g, "").length === 11, "CPF invalido."),
  nascimento: requiredDate("Informe a data de nascimento."),
  convenio: z.string().trim().optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  nomeResponsavel: z.string().trim().min(1, "Informe o nome do responsavel.").max(255),
  telefone: z.string().trim().min(1, "Informe o telefone do responsavel.").max(20),
  telefone2: z.string().trim().max(20).optional().nullable(),
  nomeMae: nullableTrimmed,
  nomePai: nullableTrimmed,
  sexo: z.string().trim().min(1, "Selecione o sexo.").max(20),
  dataInicio: requiredDate("Informe a data de inicio."),
  fotoAtual: z.string().trim().max(255).optional().nullable(),
  laudoAtual: z.string().trim().max(255).optional().nullable(),
  documentoAtual: z.string().trim().max(255).optional().nullable(),
  ativo: z.union([z.string(), z.number(), z.boolean()]).optional().nullable(),
  terapias: z.array(z.string().trim().min(1).max(40)).optional().default([]),
});

export type PacientesQueryInput = z.infer<typeof pacientesQuerySchema>;
export type SavePacienteInput = z.infer<typeof savePacienteSchema>;
