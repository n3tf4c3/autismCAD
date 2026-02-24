import Link from "next/link";
import { requireAdminGeral } from "@/server/auth/auth";
import {
  ACCESS_LOG_RETENTION_DAYS,
  listRecentAccessLogs,
} from "@/server/modules/access-logs/access-logs.service";
import { toAppError } from "@/server/shared/errors";

const ACCESS_LOG_TIMEZONE = "America/Cuiaba";

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: ACCESS_LOG_TIMEZONE,
  }).format(value);
}

function statusBadge(status: string | null | undefined) {
  const value = String(status || "").toUpperCase();
  if (value === "FALHA") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Falha
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      Sucesso
    </span>
  );
}

export default async function LogsAcessoPage() {
  try {
    await requireAdminGeral();
  } catch (error) {
    const err = toAppError(error);
    const message =
      err.status === 403 ? "Acesso negado." : err.status === 401 ? "Nao autenticado." : err.message;

    return (
      <main className="rounded-xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-gray-500">Administracao</p>
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Log de acessos</h1>
          <p className="mt-2 text-sm text-red-600">{message}</p>
        </div>
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  let logs: Awaited<ReturnType<typeof listRecentAccessLogs>> = [];
  let loadError: string | null = null;

  try {
    logs = await listRecentAccessLogs(300);
  } catch (error) {
    const err = toAppError(error);
    loadError = err.message || "Falha ao carregar logs de acesso.";
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-gray-500">Administracao</p>
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Log de acessos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Tentativas de login (sucesso e falha). Retencao automatica de {ACCESS_LOG_RETENTION_DAYS} dias.
          </p>
          <p className="mt-1 text-xs text-gray-500">Horarios exibidos em Cuiaba/MT (GMT-4).</p>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        {loadError ? (
          <p className="mb-3 text-sm text-red-600">{loadError}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Data/Hora (Cuiaba GMT-4)</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">IP de origem</th>
                <th className="px-3 py-2">Browser</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-3 py-2">{statusBadge(log.status)}</td>
                    <td className="px-3 py-2 text-gray-900">
                      {log.user_nome || (log.user_id ? "Usuario removido" : "Nao identificado")}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{log.user_email}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {log.ip_origem || "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{log.browser || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-sm text-gray-500" colSpan={6}>
                    Nenhum log de acesso nos ultimos {ACCESS_LOG_RETENTION_DAYS} dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
