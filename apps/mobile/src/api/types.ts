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

// Payload JSONB da evolucao: campos exibidos diretamente + chaves usadas pelas agregacoes
// (itensDesempenho/itens, comportamentos) via index signature.
export type EvolucaoPayload = {
  titulo?: string;
  conduta?: string;
  descricao?: string;
  [key: string]: unknown;
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
  atendimentos?: {
    id: number;
    data: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    profissional_nome?: string | null;
    presenca: string;
    duracao_min: number;
  }[];
  evolucoes?: {
    id: number;
    data: string;
    profissional_nome?: string | null;
    payload?: EvolucaoPayload | null;
  }[];
};
