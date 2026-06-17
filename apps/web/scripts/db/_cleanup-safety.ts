// Salvaguardas operacionais compartilhadas pelos scripts de cleanup (achado 98).
// Sempre loga o alvo mascarado antes de aplicar e, ao mirar um banco remoto, exige
// confirmacao explicita para evitar execucao acidental contra producao.

export function maskDbTarget(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    const database = u.pathname.replace(/^\//, "") || "?";
    return `${u.hostname}/${database}`;
  } catch {
    return "(DATABASE_URL ilegivel)";
  }
}

function isLocalHost(databaseUrl: string): boolean {
  try {
    const host = new URL(databaseUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

// Loga o alvo e o modo; ao aplicar contra banco remoto, exige --yes-prod ou
// CLEANUP_CONFIRM=1. Em dry-run ou banco local, apenas loga.
export function assertApplyConfirmed(
  apply: boolean,
  databaseUrl: string,
  argv: string[] = process.argv
): void {
  const target = maskDbTarget(databaseUrl);
  console.log(`[cleanup] alvo: ${target} | modo: ${apply ? "apply" : "dry-run"}`);
  if (!apply || isLocalHost(databaseUrl)) return;

  const confirmed = argv.includes("--yes-prod") || process.env.CLEANUP_CONFIRM === "1";
  if (!confirmed) {
    throw new Error(
      `Aplicacao contra banco remoto (${target}) requer confirmacao explicita: ` +
        "use --yes-prod ou defina CLEANUP_CONFIRM=1."
    );
  }
}
