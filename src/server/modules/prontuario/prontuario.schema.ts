import { z } from "zod";

export const DOC_TYPES = ["ANAMNESE", "PLANO_TERAPEUTICO", "RELATORIO_MULTIPROFISSIONAL", "OUTRO"] as const;
export type DocTipo = (typeof DOC_TYPES)[number];

export const DOC_STATUS = ["Rascunho", "Finalizado"] as const;
export type DocStatus = (typeof DOC_STATUS)[number];

export const docTipoSchema = z.enum(DOC_TYPES);
export const docStatusSchema = z.enum(DOC_STATUS).optional();

export const prontuarioDocumentoPayloadSchema = z
  .object({
    introducao: z.string().trim().min(1).optional().nullable(),
    avaliacao: z.string().trim().min(1).optional().nullable(),
    objetivos: z.array(z.string().trim().min(1)).optional(),
    observacoes: z.string().trim().min(1).optional().nullable(),
  })
  .passthrough();

export const salvarDocumentoSchema = z.object({
  tipo: docTipoSchema,
  status: docStatusSchema,
  titulo: z.string().trim().max(180).optional().nullable(),
  payload: prontuarioDocumentoPayloadSchema.optional().default({}),
});

export type SalvarDocumentoInput = z.infer<typeof salvarDocumentoSchema>;

export const evolucaoPayloadSchema = z.object({}).passthrough();

export const criarEvolucaoSchema = z.object({
  data: z.string().trim().optional(),
  atendimentoId: z.coerce.number().int().positive().optional().nullable(),
  terapeutaId: z.coerce.number().int().positive().optional().nullable(),
  payload: evolucaoPayloadSchema.optional().default({}),
});

export type CriarEvolucaoInput = z.infer<typeof criarEvolucaoSchema>;

export const atualizarEvolucaoSchema = criarEvolucaoSchema.partial();
export type AtualizarEvolucaoInput = z.infer<typeof atualizarEvolucaoSchema>;

