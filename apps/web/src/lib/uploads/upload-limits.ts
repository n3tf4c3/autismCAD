export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isValidUploadSize(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= MAX_UPLOAD_BYTES;
}
