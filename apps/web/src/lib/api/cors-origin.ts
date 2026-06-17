// Achado 106: resolve a origem permitida para CORS de /api/v1.
// Em producao nao retornamos "*" por padrao (qualquer origem web poderia chamar a API
// caso obtivesse um token); exige API_V1_CORS_ORIGIN explicito. Fora de producao o
// coringa facilita Expo web/dev e tooling. Retorno null => nao emitir o header.

export function resolveCorsAllowOrigin(params: {
  configured: string | undefined;
  isProduction: boolean;
}): string | null {
  const configured = params.configured?.trim();
  if (configured) return configured;
  return params.isProduction ? null : "*";
}
