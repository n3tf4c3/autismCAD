import "server-only";

export {
  listarTerapeutas,
  obterTerapeutaDetalhe,
  salvarTerapeuta,
  obterTerapeutaPorUsuario,
  terapeutaAtendePaciente,
  deleteTerapeuta,
  setTerapeutaAtivo,
} from "@/server/modules/profissionais/profissionais.service";
