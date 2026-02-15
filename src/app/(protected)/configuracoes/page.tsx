import { requireAdminGeral } from "@/server/auth/auth";
import { ConfiguracoesPermissoesClient } from "@/app/(protected)/configuracoes/permissoes.client";
import Link from "next/link";
import { toAppError } from "@/server/shared/errors";

export default async function ConfiguracoesPage() {
  // Protege a tela e mantem compatibilidade com os endpoints (admin-geral only).
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
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Configuracoes</h1>
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
  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-gray-500">Administracao</p>
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Permissoes por papel</h1>
          <p className="mt-2 text-sm text-gray-600">
            Crie usuarios e ajuste permissoes por papel. (Acesso restrito ao admin-geral.)
          </p>
        </div>
      </section>

      <ConfiguracoesPermissoesClient />
    </div>
  );
}
