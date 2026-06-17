// Validacao semantica reutilizada pelos schemas (contrato compartilhado web + mobile).
// Achados 76/88/101: alem do formato, garantir faixa real de horario e data de
// calendario valida, rejeitando valores como "99:99" ou "2026-02-31".

// HH:MM ou HH:MM:SS com faixa real (hora 00-23, minuto/segundo 00-59).
export function isValidTimeOfDay(value: string): boolean {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return false;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = m[3] != null ? Number(m[3]) : 0;
  return hours <= 23 && minutes <= 59 && seconds <= 59;
}

// YYYY-MM-DD como data de calendario real (rejeita mes/dia fora de faixa e datas
// inexistentes como 2026-02-31).
export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
