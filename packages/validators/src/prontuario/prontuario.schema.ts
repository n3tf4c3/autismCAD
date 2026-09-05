import { z } from "zod";
import { isCalendarDate } from "../common/datetime";
import { normalizeClinicalCounts } from "./contagens";
import {
  engajamentoValueSchema,
  normalizeEngajamento,
} from "./engajamento";

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

const evolucaoItemV2Schema = z
  .object({
    ensino: evolucaoTextoSchema,
    habilidade: evolucaoTextoSchema,
    opcao: engajamentoValueSchema.optional().nullable(),
    desempenho: evolucaoTextoSchema,
    tipoAjuda: evolucaoTextoSchema,
    tentativas: z.union([z.number(), z.string()]).optional().nullable(),
    acertos: z.union([z.number(), z.string()]).optional().nullable(),
    reforcador: evolucaoTextoSchema,
  })
  .strict()
  .superRefine((item, ctx) => {
    const tentativas = parseContagem(item.tentativas);
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

export const EVOLUCAO_PAYLOAD_SCHEMA_VERSION = 2 as const;

// Achado 144: contrato de novas gravacoes. A versao 2 aceita apenas as chaves
// canonicas do item e limita engajamento a sim/nao; o schema acima permanece como
// leitor compativel para payloads historicos sem versao.
export const evolucaoPayloadV2Schema = z
  .object({
    schemaVersion: z.literal(EVOLUCAO_PAYLOAD_SCHEMA_VERSION),
    titulo: evolucaoTextoSchema,
    conduta: evolucaoTextoSchema,
    descricao: evolucaoTextoSchema,
    metas: z.array(z.string().trim()).optional(),
    itensDesempenho: z.array(evolucaoItemV2Schema).optional(),
    itens: z.never().optional(),
    comportamentos: comportamentoPayloadSchema.optional().nullable(),
    comportamento: comportamentoPayloadSchema.optional().nullable(),
  })
  .passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalidEngajamentoCounts(payload: unknown): Map<string, number> {
  if (!isRecord(payload)) return new Map();
  const items = [
    ...(Array.isArray(payload.itensDesempenho) ? payload.itensDesempenho : []),
    ...(Array.isArray(payload.itens) ? payload.itens : []),
  ];
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!isRecord(item)) continue;
    const raw = item.opcao ?? item.meta;
    if (typeof raw !== "string" || !raw.trim() || normalizeEngajamento(raw)) continue;
    const value = raw.trim();
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

// Updates de registros legados podem preservar valores antigos, mas nao introduzir
// novos textos livres. Um payload v2 nunca pode sofrer downgrade para o contrato legado.
export function isEvolucaoPayloadUpdateAllowed(current: unknown, next: unknown): boolean {
  if (evolucaoPayloadV2Schema.safeParse(next).success) return true;
  if (!isRecord(next) || Object.hasOwn(next, "schemaVersion")) return false;
  if (isRecord(current) && Object.hasOwn(current, "schemaVersion")) return false;

  const currentInvalid = invalidEngajamentoCounts(current);
  const nextInvalid = invalidEngajamentoCounts(next);
  for (const [value, count] of nextInvalid) {
    if (count > (currentInvalid.get(value) ?? 0)) return false;
  }
  return true;
}

export const criarEvolucaoSchema = z.object({
  // Achado 109: quando informada, a data deve ser de calendario real (ou vazio = usa hoje).
  data: z
    .string()
    .trim()
    .refine((value) => value === "" || isCalendarDate(value), "Data invalida. Use AAAA-MM-DD valido")
    .optional(),
  atendimentoId: z.coerce.number().int().positive().optional().nullable(),
  profissionalId: evolucaoProfissionalIdSchema,
  payload: evolucaoPayloadV2Schema.transform(normalizeClinicalCounts).optional().default({
    schemaVersion: EVOLUCAO_PAYLOAD_SCHEMA_VERSION,
  }),
});

export type CriarEvolucaoInput = z.infer<typeof criarEvolucaoSchema>;

export const atualizarEvolucaoSchema = criarEvolucaoSchema.partial().extend({
  payload: evolucaoPayloadSchema.transform(normalizeClinicalCounts).optional(),
});
export type AtualizarEvolucaoInput = z.infer<typeof atualizarEvolucaoSchema>;
