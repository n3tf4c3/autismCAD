// Versão vigente da Política de Privacidade. Ao publicar uma nova versão da política,
// suba este valor — usuários com versão aceita diferente precisarão reconsentir.
export const CURRENT_PRIVACY_POLICY_VERSION = "1.0";

export function isPolicyConsentAccepted(version: string | null | undefined): boolean {
  return version === CURRENT_PRIVACY_POLICY_VERSION;
}
