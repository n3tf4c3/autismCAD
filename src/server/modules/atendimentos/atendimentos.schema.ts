import { z } from "zod";

export const turnosPermitidos = new Set(["Matutino", "Vespertino"]);
export const presencasPermitidas = new Set([
  "Presente",
  "Ausente",
  "Nao informado",
]);

const optionalId = z.coerce.number().int().positive().optional().nullable();
const requiredId = z.coerce.number().int().positive();

const optionalBooleanLike = z
  .union([z.boolean(), z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const raw = value.trim().toLowerCase();
    if (["1", "true", "sim", "yes", "on"].includes(raw)) return true;
    if (["0", "false", "nao", "no", "off", ""].includes(raw)) return false;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed > 0 : false;
  });

export const atendimentosQuerySchema = z.object({
  pacienteId: z.coerce.number().int().positive().optional(),
  profissionalId: optionalId,
  dataIni: z.string().trim().optional(),
  dataFim: z.string().trim().optional(),
});

export const saveAtendimentoSchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  profissionalId: requiredId,
  data: z.string().trim().min(10).max(10),
  horaInicio: z.string().trim().min(4).max(8),
  horaFim: z.string().trim().min(4).max(8),
  isGrupo: optionalBooleanLike,
  turno: z.string().trim().optional(),
  periodoInicio: z.string().trim().optional().nullable(),
  periodoFim: z.string().trim().optional().nullable(),
  presenca: z.string().trim().optional(),
  motivo: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
}).strict();

export const recorrenteSchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  profissionalId: requiredId,
  horaInicio: z.string().trim().min(4).max(8),
  horaFim: z.string().trim().min(4).max(8),
  isGrupo: optionalBooleanLike,
  turno: z.string().trim().optional(),
  periodoInicio: z.string().trim().min(10).max(10),
  periodoFim: z.string().trim().min(10).max(10),
  presenca: z.string().trim().optional(),
  motivo: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
  diasSemana: z.array(z.coerce.number().int().min(0).max(6)).min(1),
});

export const excluirDiaSchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  profissionalId: optionalId,
  horaInicio: z.string().trim().min(4).max(8),
  horaFim: z.string().trim().min(4).max(8),
  turno: z.string().trim().optional(),
  periodoInicio: z.string().trim().min(10).max(10),
  periodoFim: z.string().trim().min(10).max(10),
  diaSemana: z.coerce.number().int().min(0).max(6),
});

export type AtendimentosQueryInput = z.infer<typeof atendimentosQuerySchema>;
export type SaveAtendimentoInput = z.infer<typeof saveAtendimentoSchema>;
export type RecorrenteInput = z.infer<typeof recorrenteSchema>;
export type ExcluirDiaInput = z.infer<typeof excluirDiaSchema>;
