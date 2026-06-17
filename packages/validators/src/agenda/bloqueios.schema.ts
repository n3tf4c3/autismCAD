import { z } from "zod";
import { isCalendarDate, isValidTimeOfDay } from "../common/datetime";

// Achados 76/88/101: alem do formato, exigir data de calendario real e faixa de hora.
const dataYmd = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida")
  .refine(isCalendarDate, "Data invalida. Use AAAA-MM-DD valido");
const horaHm = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Hora invalida")
  .refine(isValidTimeOfDay, "Hora fora da faixa valida (00:00 a 23:59)");

export const listarBloqueiosSchema = z.object({
  profissionalId: z.coerce.number().int().positive(),
  dataIni: dataYmd.optional(),
  dataFim: dataYmd.optional(),
});

export const criarBloqueiosSchema = z
  .object({
    profissionalId: z.coerce.number().int().positive(),
    datas: z.array(dataYmd).min(1).max(120),
    horaInicio: horaHm,
    horaFim: horaHm,
    observacoes: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.horaFim <= data.horaInicio) {
      ctx.addIssue({
        code: "custom",
        path: ["horaFim"],
        message: "Hora final deve ser maior que a hora inicial",
      });
    }
  });

export type ListarBloqueiosInput = z.infer<typeof listarBloqueiosSchema>;
export type CriarBloqueiosInput = z.infer<typeof criarBloqueiosSchema>;
