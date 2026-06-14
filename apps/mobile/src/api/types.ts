// Tipos das respostas da API v1 (apenas os campos consumidos pelo app).

// Espelha o retorno de listarAtendimentos (atendimentos.service.ts) — camelCase.
export type Atendimento = {
  id: number;
  data: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  pacienteId?: number | null;
  pacienteNome?: string | null;
  profissionalId?: number | null;
  profissionalNome?: string | null;
  presenca?: string | null;
};

export type Paciente = {
  id: number;
  nome: string;
  foto?: string | null;
};

// Espelha o retorno de consolidateEvolutivoReport (relatorios.service.ts).
export type EvolutivoReport = {
  paciente: { id: number; nome: string };
  periodo?: { from: string; to: string };
  indicadores?: {
    totalAtendimentos?: number;
    presentes?: number;
    ausentes?: number;
    taxaPresencaPercent?: number;
  };
  destaques?: {
    ultimasObservacoes?: {
      data: string;
      profissional_nome?: string | null;
      texto: string;
    }[];
  };
  resumoAutomatico?: { texto?: string };
  evolucoes?: {
    id: number;
    data: string;
    profissional_nome?: string | null;
    payload?: {
      titulo?: string;
      conduta?: string;
      descricao?: string;
    } | null;
  }[];
};
