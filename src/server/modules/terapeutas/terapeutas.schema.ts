import { z } from "zod";

export const especialidadesPermitidas = new Set([
  "Psicologia",
  "Terapia Ocupacional",
  "Fonoaudiologia",
  "Fisioterapia",
  "Psicopedagogia",
  "Acompanhante Terapeutico (AT)",
]);

const nullableTrimmed = z.string().trim().max(255).optional().nullable();
const nullableDate = z.string().trim().optional().nullable();

export const terapeutasQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nome: z.string().trim().max(120).optional(),
  cpf: z.string().trim().max(20).optional(),
  especialidade: z.string().trim().max(80).optional(),
});

export const saveTerapeutaSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  cpf: z.string().trim().min(11).max(20),
  nascimento: nullableDate,
  email: z.string().trim().email().max(120).optional().nullable(),
  telefone: z.string().trim().max(20).optional().nullable(),
  endereco: nullableTrimmed,
  logradouro: z.string().trim().max(180).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  bairro: z.string().trim().max(120).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  cep: z.string().trim().max(12).optional().nullable(),
  especialidade: z.string().trim().min(1).max(80),
});

export type TerapeutasQueryInput = z.infer<typeof terapeutasQuerySchema>;
export type SaveTerapeutaInput = z.infer<typeof saveTerapeutaSchema>;
