import { z } from "zod";

export const DOC_TYPES = [
  "ANAMNESE",
  "PLANO_TERAPEUTICO",
  "PLANO_ENSINO",
  "RELATORIO_MULTIPROFISSIONAL",
  "OUTRO",
] as const;
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

const evolucaoTextoSchema = z.string().trim().optional().nullable();

const evolucaoItemSchema = z
  .object({
    ensino: evolucaoTextoSchema,
    habilidade: evolucaoTextoSchema,
    opcao: evolucaoTextoSchema,
    meta: evolucaoTextoSchema,
    desempenho: evolucaoTextoSchema,
    performance: evolucaoTextoSchema,
    tipoAjuda: evolucaoTextoSchema,
    tipo_ajuda: evolucaoTextoSchema,
    ajuda: evolucaoTextoSchema,
    tentativas: z.union([z.number(), z.string()]).optional().nullable(),
    tentativa: z.union([z.number(), z.string()]).optional().nullable(),
    acertos: z.union([z.number(), z.string()]).optional().nullable(),
    reforcador: evolucaoTextoSchema,
    reforco: evolucaoTextoSchema,
  })
  .passthrough();

const comportamentoPayloadSchema = z
  .object({
    resultado: evolucaoTextoSchema,
    descricao: evolucaoTextoSchema,
    negativos: z.array(z.string().trim()).optional(),
    positivos: z.array(z.string().trim()).optional(),
    quantidades: z
      .object({
        negativo: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
        positivo: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export const evolucaoPayloadSchema = z
  .object({
    titulo: evolucaoTextoSchema,
    conduta: evolucaoTextoSchema,
    descricao: evolucaoTextoSchema,
    metas: z.array(z.string().trim()).optional(),
    itensDesempenho: z.array(evolucaoItemSchema).optional(),
    itens: z.array(evolucaoItemSchema).optional(),
    comportamentos: comportamentoPayloadSchema.optional().nullable(),
    comportamento: comportamentoPayloadSchema.optional().nullable(),
  })
  .passthrough();

export const criarEvolucaoSchema = z.object({
  data: z.string().trim().optional(),
  atendimentoId: z.coerce.number().int().positive().optional().nullable(),
  terapeutaId: z.coerce.number().int().positive().optional().nullable(),
  payload: evolucaoPayloadSchema.optional().default({}),
});

export type CriarEvolucaoInput = z.infer<typeof criarEvolucaoSchema>;

export const atualizarEvolucaoSchema = criarEvolucaoSchema.partial();
export type AtualizarEvolucaoInput = z.infer<typeof atualizarEvolucaoSchema>;
