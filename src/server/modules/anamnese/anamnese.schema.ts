import { z } from "zod";

export const anamneseStatusSchema = z.enum(["Rascunho", "Finalizada"]);

export const saveAnamneseSchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    status: anamneseStatusSchema.optional(),
  })
  .passthrough();

export const listVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type SaveAnamneseInput = z.infer<typeof saveAnamneseSchema> & Record<string, unknown>;
