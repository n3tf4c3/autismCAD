import { z } from "zod";

// Achado 111: schemas Zod das respostas v1 validados em runtime (evita `as T` cego:
// resposta HTML de proxy, payload parcial ou drift quebram com erro claro). Espelham os
// tipos de @autismcad/validators/api/v1 (contrato compartilhado, importados como type nas
// telas). Ficam no app porque o Metro nao resolve import de VALOR daquele subpath de
// workspace. `.passthrough()` preserva campos extras/dinamicos (ex.: payload de evolucao).

const atendimentoSchema = z
  .object({
    id: z.number(),
    data: z.string(),
    horaInicio: z.string().nullish(),
    horaFim: z.string().nullish(),
    pacienteId: z.number().nullish(),
    pacienteNome: z.string().nullish(),
    profissionalId: z.number().nullish(),
    profissionalNome: z.string().nullish(),
    presenca: z.string().nullish(),
    evolucaoId: z.number().nullish(),
  })
  .passthrough();

const pacienteSchema = z
  .object({
    id: z.number(),
    nome: z.string(),
    foto: z.string().nullish(),
  })
  .passthrough();

export const atendimentosListResponseSchema = z
  .object({ items: z.array(atendimentoSchema) })
  .passthrough();

export const pacientesListResponseSchema = z
  .object({ items: z.array(pacienteSchema) })
  .passthrough();

export const clinicTimeResponseSchema = z.object({ today: z.string() }).passthrough();

// Evolucao carregada para edicao: garante id e o payload (objeto dinamico) preservado.
export const evolucaoDetalheResponseSchema = z
  .object({
    evolucao: z
      .object({
        id: z.number(),
        pacienteId: z.number(),
        profissionalId: z.number().nullish(),
        atendimentoId: z.number().nullish(),
        data: z.string(),
        payload: z.record(z.string(), z.unknown()).nullish(),
      })
      .passthrough(),
  })
  .passthrough();

// Envelope critico do relatorio: garante report.paciente; o restante (indicadores,
// atendimentos, evolucoes com payload dinamico) passa intacto via passthrough.
export const evolutivoReportResponseSchema = z
  .object({
    report: z
      .object({
        paciente: z.object({ id: z.number(), nome: z.string() }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();
