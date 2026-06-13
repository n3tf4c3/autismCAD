// Achado 60: regra (pura) de rate limit/lockout de login por janela deslizante.
// Bloqueia quando o numero de falhas recentes excede o limite por e-mail ou por IP.
// A contagem de falhas e a janela vivem no banco (access_logs); aqui fica apenas o
// criterio de limiar, isolado para teste.
export type LoginRateLimitConfig = {
  windowMinutes: number;
  maxFailuresPerEmail: number;
  maxFailuresPerIp: number;
};

// Limites conservadores: o de IP e generoso para nao penalizar redes com NAT
// (varias pessoas atras do mesmo IP, ex.: a clinica).
export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitConfig = {
  windowMinutes: 15,
  maxFailuresPerEmail: 8,
  maxFailuresPerIp: 30,
};

export function exceedsLoginRateLimit(
  counts: { emailFailures: number; ipFailures: number; hasIp: boolean },
  config: LoginRateLimitConfig = DEFAULT_LOGIN_RATE_LIMIT
): boolean {
  if (counts.emailFailures >= config.maxFailuresPerEmail) return true;
  if (counts.hasIp && counts.ipFailures >= config.maxFailuresPerIp) return true;
  return false;
}
