import { z } from "zod";

export const anamneseStatusSchema = z.enum(["Rascunho", "Finalizada"]);

const optionalTextSchema = z.string().trim().optional().nullable();
const optionalBoolLikeSchema = z.union([z.boolean(), z.string(), z.number()]).optional().nullable();

export const saveAnamneseSchema = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    status: anamneseStatusSchema.optional(),
    entrevistaPor: optionalTextSchema,
    dataEntrevista: optionalTextSchema,
    possuiDiagnostico: optionalBoolLikeSchema,
    diagnostico: optionalTextSchema,
    laudoDiagnostico: optionalTextSchema,
    medicoAcompanhante: optionalTextSchema,
    fezTerapia: optionalBoolLikeSchema,
    terapias: optionalTextSchema,
    frequencia: optionalTextSchema,
    marcosMotores: optionalTextSchema,
    linguagem: optionalTextSchema,
    comunicacao: optionalTextSchema,
    escola: optionalTextSchema,
    serie: optionalTextSchema,
    periodoEscolar: optionalTextSchema,
    acompanhanteEscolar: optionalBoolLikeSchema,
    observacoesEscolares: optionalTextSchema,
    encaminhamento: optionalTextSchema,
    frustracoes: optionalTextSchema,
    humor: optionalTextSchema,
    estereotipias: optionalTextSchema,
    autoagressao: optionalTextSchema,
    heteroagressao: optionalTextSchema,
    seletividadeAlimentar: optionalTextSchema,
    rotinaSono: optionalTextSchema,
    medicamentosUsoAnterior: optionalTextSchema,
    medicamentosUsoAtual: optionalTextSchema,
    dificuldadesFamilia: optionalTextSchema,
    expectativasTerapia: optionalTextSchema,
  })
  .strict();

export const listVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type SaveAnamneseInput = z.infer<typeof saveAnamneseSchema>;
