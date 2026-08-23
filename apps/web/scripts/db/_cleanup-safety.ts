// Salvaguardas operacionais compartilhadas por scripts de manutencao do banco.
// Sempre loga o alvo mascarado antes de aplicar e, ao mirar um banco remoto, exige
// confirmacao explicita para evitar execucao acidental contra producao (achado 98).

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

type RemoteWriteConfirmationOptions = {
  argv?: readonly string[];
  confirmationEnv?: string;
  env?: Readonly<Record<string, string | undefined>>;
  logPrefix: string;
  operation: string;
};

// Salvaguarda comum para scripts que escrevem no banco. O chamador informa o
// contexto e, opcionalmente, uma variavel de confirmacao propria.
export function assertRemoteWriteConfirmed(
  databaseUrl: string,
  options: RemoteWriteConfirmationOptions
): void {
  const target = maskDbTarget(databaseUrl);
  console.log(`[${options.logPrefix}] alvo: ${target} | modo: apply`);
  if (isLocalHost(databaseUrl)) return;

  const argv = options.argv ?? process.argv;
  const env = options.env ?? process.env;
  const confirmed =
    argv.includes("--yes-prod") ||
    (options.confirmationEnv ? env[options.confirmationEnv] === "1" : false);
  if (confirmed) return;

  const envHint = options.confirmationEnv
    ? ` ou defina ${options.confirmationEnv}=1`
    : "";
  throw new Error(
    `${options.operation} contra banco remoto (${target}) requer confirmacao explicita: ` +
      `use --yes-prod${envHint}.`
  );
}

// Loga o alvo e o modo; ao aplicar contra banco remoto, exige --yes-prod ou
// CLEANUP_CONFIRM=1. Em dry-run ou banco local, apenas loga.
export function assertApplyConfirmed(
  apply: boolean,
  databaseUrl: string,
  argv: string[] = process.argv
): void {
  const target = maskDbTarget(databaseUrl);
  if (!apply) {
    console.log(`[cleanup] alvo: ${target} | modo: dry-run`);
    return;
  }

  assertRemoteWriteConfirmed(databaseUrl, {
    argv,
    confirmationEnv: "CLEANUP_CONFIRM",
    logPrefix: "cleanup",
    operation: "Aplicacao",
  });
}
