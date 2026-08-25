export type AtendimentoControleDevolutiva = {
  id: number;
  paciente_id: number;
  paciente_nome: string | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  presenca: string;
  profissional_id: number | null;
  profissional_nome: string | null;
  evolucao_id: number | null;
};

export type PendenciaDevolutiva = {
  atendimentoId: number;
  pacienteId: number;
  pacienteNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  profissionalId: number | null;
  profissionalNome: string;
};

function horaHm(value?: string | null): string {
  return value ? String(value).slice(0, 5) : "";
}

export function consolidarPendenciasDevolutiva(
  rows: AtendimentoControleDevolutiva[]
): PendenciaDevolutiva[] {
  return rows
    .filter((row) => row.presenca === "Presente" && row.evolucao_id == null)
    .map((row) => ({
      atendimentoId: Number(row.id),
      pacienteId: Number(row.paciente_id),
      pacienteNome: row.paciente_nome || "Paciente",
      data: String(row.data).slice(0, 10),
      horaInicio: horaHm(row.hora_inicio),
      horaFim: horaHm(row.hora_fim),
      profissionalId: row.profissional_id == null ? null : Number(row.profissional_id),
      profissionalNome: row.profissional_nome || "Profissional não informado",
    }))
    .sort(
      (a, b) =>
        a.profissionalNome.localeCompare(b.profissionalNome, "pt-BR", { sensitivity: "base" }) ||
        a.data.localeCompare(b.data) ||
        a.horaInicio.localeCompare(b.horaInicio) ||
        a.pacienteNome.localeCompare(b.pacienteNome, "pt-BR", { sensitivity: "base" })
    );
}
