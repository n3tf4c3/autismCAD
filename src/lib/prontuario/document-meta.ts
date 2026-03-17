function normalizeTipo(tipo: string): string {
  return String(tipo || "").trim().toUpperCase();
}

export function getDocumentoTipoLabel(tipo: string): string {
  switch (normalizeTipo(tipo)) {
    case "ANAMNESE":
      return "Anamnese";
    case "PLANO_TERAPEUTICO":
      return "Plano terapeutico";
    case "PLANO_ENSINO":
      return "Plano de Ensino";
    case "RELATORIO_MULTIPROFISSIONAL":
      return "Relatorio multiprofissional";
    case "OUTRO":
      return "Outro";
    default:
      return normalizeTipo(tipo) || "Documento";
  }
}

export function getDocumentoNovoHref(pacienteId: number | string, tipo: string): string {
  const normalized = normalizeTipo(tipo);
  if (normalized === "PLANO_ENSINO") {
    return `/prontuario/${pacienteId}/plano-ensino`;
  }
  const safeTipo = normalized || "ANAMNESE";
  return `/prontuario/${pacienteId}/novo-documento?tipo=${encodeURIComponent(safeTipo)}`;
}

export function getDocumentoEditarHref(pacienteId: number | string, tipo: string, documentoId: number | string): string {
  const normalized = normalizeTipo(tipo);
  if (normalized === "PLANO_ENSINO") {
    return `/prontuario/${pacienteId}/plano-ensino?documentoId=${encodeURIComponent(String(documentoId))}`;
  }
  return getDocumentoNovoHref(pacienteId, tipo);
}
