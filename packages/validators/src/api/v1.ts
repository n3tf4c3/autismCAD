// Contrato das respostas da API v1 consumidas pelo app mobile (achado 79).
// Fonte unica de verdade: o mobile importa estes tipos e as rotas web sao verificadas
// contra eles (`satisfies`), prevenindo drift entre servidor e cliente.

// Item de atendimento (camelCase) exposto por GET /api/v1/atendimentos.
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

// Item de paciente exposto por GET /api/v1/pacientes.
export type Paciente = {
  id: number;
  nome: string;
  foto?: string | null;
};

// Payload JSONB da evolucao: campos exibidos diretamente + chaves usadas pelas
// agregacoes (itensDesempenho/itens, comportamentos) via index signature.
export type EvolucaoPayload = {
  titulo?: string;
  conduta?: string;
  descricao?: string;
  [key: string]: unknown;
};

// Devolutiva consolidada exposta por GET /api/v1/relatorios/evolutivo.
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

// Envelopes de resposta (corpo JSON completo de cada rota).
export type AtendimentosListResponse = { items: Atendimento[] };
export type PacientesListResponse = { items: Paciente[] };
export type EvolutivoReportResponse = { report: EvolutivoReport };
export type ClinicTimeResponse = { today: string };
