import "server-only";

import { normalizeDateOnlyLoose, normalizeOptionalText } from "@/server/shared/normalize";

type AnyRecord = Record<string, unknown>;

export type PlanoEnsinoBloco = {
  habilidade: string | null;
  ensino: string | null;
  objetivoEnsino: string | null;
  recursos: string | null;
  procedimento: string | null;
  suportes: string | null;
  alvo: string | null;
  objetivoEspecifico: string | null;
  criterioSucesso: string | null;
};

export type PlanoEnsinoPayload = {
  especialidade: string | null;
  dataInicio: string | null;
  dataFinal: string | null;
  blocos: PlanoEnsinoBloco[];
};

function asRecord(value: unknown): AnyRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AnyRecord;
}

function sanitizeBloco(value: unknown): PlanoEnsinoBloco {
  const rec = asRecord(value);
  return {
    habilidade: normalizeOptionalText(String(rec.habilidade ?? "")),
    ensino: normalizeOptionalText(String(rec.ensino ?? "")),
    objetivoEnsino: normalizeOptionalText(String(rec.objetivoEnsino ?? rec.objetivo_ensino ?? "")),
    recursos: normalizeOptionalText(String(rec.recursos ?? "")),
    procedimento: normalizeOptionalText(String(rec.procedimento ?? "")),
    suportes: normalizeOptionalText(String(rec.suportes ?? "")),
    alvo: normalizeOptionalText(String(rec.alvo ?? rec.target ?? "")),
    objetivoEspecifico: normalizeOptionalText(
      String(rec.objetivoEspecifico ?? rec.objetivo_especifico ?? "")
    ),
    criterioSucesso: normalizeOptionalText(String(rec.criterioSucesso ?? rec.criterio_sucesso ?? "")),
  };
}

function hasBlocoContent(bloco: PlanoEnsinoBloco): boolean {
  return Object.values(bloco).some(Boolean);
}

export function sanitizePlanoEnsinoPayload(input: unknown): PlanoEnsinoPayload {
  const rec = asRecord(input);
  const rawBlocos = Array.isArray(rec.blocos)
    ? rec.blocos
    : Array.isArray(rec.itens)
      ? rec.itens
      : [];

  return {
    especialidade: normalizeOptionalText(String(rec.especialidade ?? "")),
    dataInicio: normalizeDateOnlyLoose(String(rec.dataInicio ?? rec.data_inicio ?? "")),
    dataFinal: normalizeDateOnlyLoose(String(rec.dataFinal ?? rec.data_final ?? "")),
    blocos: rawBlocos.map(sanitizeBloco).filter(hasBlocoContent),
  };
}

export function getPlanoEnsinoTitulo(payload: PlanoEnsinoPayload): string {
  return payload.especialidade ? `Plano de Ensino - ${payload.especialidade}` : "Plano de Ensino";
}
