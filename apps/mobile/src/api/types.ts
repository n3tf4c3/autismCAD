// Achado 79: os contratos das respostas da API v1 vivem em @autismcad/validators
// (fonte unica de verdade compartilhada com o servidor). Reexportados aqui para nao
// quebrar os import sites existentes do app.
export type {
  Atendimento,
  Paciente,
  EvolucaoPayload,
  EvolucaoDetalhe,
  EvolutivoReport,
} from "@autismcad/validators/api/v1";
