// Achado 103 / 131: uma credencial emitida so continua valida enquanto a versao embutida
// nela (claim 'ver') bater com users.token_version. A troca de senha incrementa a coluna,
// invalidando o que foi emitido antes, sem precisar de store de sessao. Vale para as duas
// superficies: token Bearer do mobile e sessao de cookie (JWT do NextAuth) da web.
// Credenciais emitidas antes do claim (tokenVersion null) contam como versao 0 (default),
// preservando as sessoes vigentes no momento da implantacao.

import { AppError } from "@autismcad/shared/errors";

export function isCredentialVersionRevoked(params: {
  tokenVersion: number | null;
  currentVersion: number;
}): boolean {
  const claimed = params.tokenVersion ?? 0;
  return claimed !== params.currentVersion;
}

// Achado 131: guard usado pelos tres pontos de entrada da web (requireUser,
// requirePermission, requireAdminGeral). O layout protegido faz a mesma checagem, mas
// redireciona para /login em vez de lancar.
export function assertSessionNotRevoked(params: {
  tokenVersion: number | null;
  currentVersion: number;
}): void {
  if (isCredentialVersionRevoked(params)) {
    throw new AppError("Sessao expirada, faca login novamente", 401, "SESSION_REVOKED");
  }
}
