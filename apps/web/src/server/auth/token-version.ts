// Achado 103: um token Bearer mobile so e valido se a versao de credencial embutida
// (claim 'ver') ainda bate com users.token_version. A troca de senha incrementa a coluna,
// invalidando tokens anteriores sem precisar de store. Tokens emitidos antes do claim
// (tokenVersion null) contam como versao 0 (default), preservando sessoes ao implantar.

export function isMobileTokenRevoked(params: {
  tokenVersion: number | null;
  currentVersion: number;
}): boolean {
  const claimed = params.tokenVersion ?? 0;
  return claimed !== params.currentVersion;
}
