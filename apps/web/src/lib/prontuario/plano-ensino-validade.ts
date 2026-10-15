import { isCalendarDate } from "@autismcad/shared/datetime";

export type PlanoEnsinoListaItem = {
  id: number;
  pacienteId: number;
  pacienteNome: string;
  especialidade: string | null;
  version: number;
  status: string;
  cadastradoEm: string | null;
  dataInicio: string | null;
  dataFinal: string | null;
  atual: boolean;
};

export function chaveEspecialidadePlano(especialidade: string | null): string {
  return (especialidade ?? "").trim().toLowerCase();
}

// Versoes sao sequenciais por paciente/tipo; um rascunho nao substitui o finalizado.
export function marcarPlanosEnsinoAtuais(planos: Omit<PlanoEnsinoListaItem, "atual">[]): PlanoEnsinoListaItem[] {
  const atuais = new Set<string>();
  return [...planos]
    .sort((a, b) => b.version - a.version || b.id - a.id)
    .map((plano) => {
      const key = `${plano.pacienteId}:${chaveEspecialidadePlano(plano.especialidade)}`;
      const atual = plano.status === "Finalizado" && !atuais.has(key);
      if (atual) atuais.add(key);
      return { ...plano, atual };
    });
}

export function diasAteVencimento(dataFinal: string | null, hoje: string): number | null {
  if (!dataFinal || !isCalendarDate(dataFinal) || !isCalendarDate(hoje)) return null;
  return Math.round((Date.parse(`${dataFinal}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
}

export function situacaoPlanoEnsino(plano: PlanoEnsinoListaItem, hoje: string, antecedencia: number) {
  const dias = diasAteVencimento(plano.dataFinal, hoje);
  if (plano.status !== "Finalizado") return { tipo: "rascunho", label: "Rascunho" } as const;
  if (!plano.atual) return { tipo: "historico", label: "Histórico" } as const;
  if (dias === null) return { tipo: "sem_data", label: "Sem data final" } as const;
  if (dias < 0) return { tipo: "vencido", label: `Vencido há ${-dias} dia${dias === -1 ? "" : "s"}` } as const;
  if (dias === 0) return { tipo: "hoje", label: "Vence hoje" } as const;
  if (dias <= antecedencia) return { tipo: "a_vencer", label: `Vence em ${dias} dia${dias === 1 ? "" : "s"}` } as const;
  return { tipo: "em_dia", label: "Em dia" } as const;
}

export function selecionarAlertasPlanos(planos: PlanoEnsinoListaItem[], hoje: string, antecedencia: number) {
  return planos
    .filter((plano) => {
      if (!plano.atual || plano.status !== "Finalizado") return false;
      const dias = diasAteVencimento(plano.dataFinal, hoje);
      return dias === null || dias <= antecedencia;
    })
    .sort((a, b) => (a.dataFinal ?? "9999").localeCompare(b.dataFinal ?? "9999") || a.pacienteNome.localeCompare(b.pacienteNome, "pt-BR"));
}
