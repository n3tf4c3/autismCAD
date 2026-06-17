import { z } from "zod";
import { isCalendarDate, isValidTimeOfDay } from "../common/datetime";

export const turnosPermitidos = new Set(["Matutino", "Vespertino"]);
export const presencasPermitidas = new Set([
  "Presente",
  "Ausente",
  "Nao informado",
]);

const optionalId = z.coerce.number().int().positive().optional().nullable();
const requiredId = z.coerce.number().int().positive();

// Achado 65: alinhar a validacao de horario ao que o service normaliza (HH:MM ou
// HH:MM:SS, hora com dois digitos), evitando que "9:00" passe aqui e falhe depois.
// Achado 76: alem do formato, exigir faixa real de hora/minuto (rejeita "99:99").
const horaField = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horario invalido. Use HH:MM ou HH:MM:SS")
  .refine(isValidTimeOfDay, "Horario fora da faixa valida (00:00 a 23:59)");

// Achado 88/101: data-only que precisa ser uma data de calendario real.
const dataField = z
  .string()
  .trim()
  .refine(isCalendarDate, "Data invalida. Use AAAA-MM-DD valido");

// Achado 110: filtros de query e periodos de atendimento avulso tambem validam data de
// calendario real (ou vazio), em vez de aceitar string livre. Vazio = sem filtro/periodo.
const optionalDataField = z
  .string()
  .trim()
  .refine((value) => value === "" || isCalendarDate(value), "Data invalida. Use AAAA-MM-DD valido")
  .optional();
const optionalNullableDataField = optionalDataField.nullable();

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

function horaParaMinutos(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function exigirHoraFimMaior(
  data: { horaInicio: string; horaFim: string },
  ctx: z.RefinementCtx
) {
  const inicio = horaParaMinutos(data.horaInicio);
  const fim = horaParaMinutos(data.horaFim);
  if (inicio !== null && fim !== null && fim <= inicio) {
    ctx.addIssue({
      code: "custom",
      path: ["horaFim"],
      message: "Hora final deve ser maior que a hora inicial",
    });
  }
}

export const atendimentosQuerySchema = z.object({
  pacienteId: z.coerce.number().int().positive().optional(),
  profissionalId: optionalId,
  dataIni: optionalDataField,
  dataFim: optionalDataField,
});

export const saveAtendimentoSchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  profissionalId: requiredId,
  data: dataField,
  horaInicio: horaField,
  horaFim: horaField,
  isGrupo: optionalBooleanLike,
  turno: z.string().trim().optional(),
  periodoInicio: optionalNullableDataField,
  periodoFim: optionalNullableDataField,
  presenca: z.string().trim().optional(),
  motivo: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
}).strict().superRefine(exigirHoraFimMaior);

export const recorrenteSchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  profissionalId: requiredId,
  horaInicio: horaField,
  horaFim: horaField,
  isGrupo: optionalBooleanLike,
  turno: z.string().trim().optional(),
  periodoInicio: dataField,
  periodoFim: dataField,
  presenca: z.string().trim().optional(),
  motivo: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
  diasSemana: z.array(z.coerce.number().int().min(0).max(6)).min(1),
}).superRefine(exigirHoraFimMaior);

export const excluirDiaSchema = z.object({
  pacienteId: z.coerce.number().int().positive(),
  profissionalId: optionalId,
  horaInicio: horaField,
  horaFim: horaField,
  turno: z.string().trim().optional(),
  periodoInicio: dataField,
  periodoFim: dataField,
  diaSemana: z.coerce.number().int().min(0).max(6),
});

export type AtendimentosQueryInput = z.infer<typeof atendimentosQuerySchema>;
export type SaveAtendimentoInput = z.infer<typeof saveAtendimentoSchema>;
export type RecorrenteInput = z.infer<typeof recorrenteSchema>;
export type ExcluirDiaInput = z.infer<typeof excluirDiaSchema>;
