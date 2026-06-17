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
  documentoId: z.coerce.number().int().positive().optional().nullable(),
  payload: prontuarioDocumentoPayloadSchema.optional().default({}),
});

export type SalvarDocumentoInput = z.infer<typeof salvarDocumentoSchema>;

const evolucaoTextoSchema = z.string().trim().optional().nullable();
const evolucaoProfissionalIdSchema = z.coerce.number().int().positive().optional().nullable();

// Achado 96: contagens chegam como numero (mobile) ou string (form web). Converte
// para numero quando possivel para validar faixa; vazio/null vira null (campo opcional).
function parseContagem(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

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
  .passthrough()
  .superRefine((item, ctx) => {
    // Achado 96: tentativas/acertos devem ser inteiros >= 0 e acertos <= tentativas.
    const tentativas = parseContagem(item.tentativas ?? item.tentativa);
    const acertos = parseContagem(item.acertos);
    if (tentativas != null && (!Number.isInteger(tentativas) || tentativas < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tentativas"],
        message: "Tentativas deve ser um inteiro maior ou igual a 0",
      });
    }
    if (acertos != null && (!Number.isInteger(acertos) || acertos < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acertos"],
        message: "Acertos deve ser um inteiro maior ou igual a 0",
      });
    }
    if (tentativas != null && acertos != null && acertos > tentativas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acertos"],
        message: "Acertos nao pode exceder tentativas",
      });
    }
  });

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
  profissionalId: evolucaoProfissionalIdSchema,
  payload: evolucaoPayloadSchema.optional().default({}),
});

export type CriarEvolucaoInput = z.infer<typeof criarEvolucaoSchema>;

export const atualizarEvolucaoSchema = criarEvolucaoSchema.partial();
export type AtualizarEvolucaoInput = z.infer<typeof atualizarEvolucaoSchema>;
