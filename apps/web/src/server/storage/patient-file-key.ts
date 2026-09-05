import { AppError } from "@autismcad/shared/errors";

export function patientUploadFilename(patientId: number, kind: string, filename: string): string {
  // UUID + hifen ocupam 37 caracteres; a chave temporaria tambem passa pelo schema de commit.
  const available = 255 - `pacientes/temp/${patientId}/${kind}/`.length - 37;
  if (filename.length <= available) return filename;
  const extension = /\.[a-zA-Z0-9]{1,12}$/.exec(filename)?.[0] ?? "";
  return filename.slice(0, Math.max(0, available - extension.length)) + extension;
}

export function patientFinalKey(patientId: number, kind: string, key: string): string {
  const temp = `pacientes/temp/${patientId}/${kind}/`;
  const final = `pacientes/${patientId}/${kind}/`;
  const result = key.startsWith(temp) ? final + key.slice(temp.length) : key;
  if (!result.startsWith(final) || !result.slice(final.length) || result.slice(final.length).includes("/")) {
    throw new AppError("Arquivo invalido para este paciente", 403, "FORBIDDEN");
  }
  if (key.length > 255 || result.length > 255) throw new AppError("Nome de arquivo muito longo", 400, "INVALID_FILE_KEY");
  return result;
}
