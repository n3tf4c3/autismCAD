import { z } from "zod";

export const turnosPermitidos = new Set(["Matutino", "Vespertino"]);
export const presencasPermitidas = new Set([
  "Presente",
  "Ausente",
  "Nao informado",
]);

const optionalId = z.coerce.number().int().positive().optional().nullable();

export const atendimentosQuerySchema = z.object({
  pacienteId: z.coerce.number().int().positive().optional(),
  profissionalId: optionalId,
  dataIni: z.string().trim().optional(),
  dataFim: z.string().trim().optional(),
});

export const saveAtendimentoSchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    profissionalId: optionalId,
    data: z.string().trim().min(10).max(10),
    horaInicio: z.string().trim().min(4).max(8),
    horaFim: z.string().trim().min(4).max(8),
    turno: z.string().trim().optional(),
    periodoInicio: z.string().trim().optional().nullable(),
    periodoFim: z.string().trim().optional().nullable(),
    presenca: z.string().trim().optional(),
    realizado: z.union([z.boolean(), z.number(), z.string()]).optional(),
    motivo: z.string().trim().optional().nullable(),
    observacoes: z.string().trim().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.profissionalId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Profissional obrigatorio",
        path: ["profissionalId"],
      });
    }
  });

export const recorrenteSchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    profissionalId: optionalId,
    horaInicio: z.string().trim().min(4).max(8),
    horaFim: z.string().trim().min(4).max(8),
    turno: z.string().trim().optional(),
    periodoInicio: z.string().trim().min(10).max(10),
    periodoFim: z.string().trim().min(10).max(10),
    presenca: z.string().trim().optional(),
    motivo: z.string().trim().optional().nullable(),
    observacoes: z.string().trim().optional().nullable(),
    diasSemana: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  })
  .superRefine((value, ctx) => {
    if (!value.profissionalId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Profissional obrigatorio",
        path: ["profissionalId"],
      });
    }
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
