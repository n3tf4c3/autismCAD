import { requireAdminGeral } from "@/server/auth/auth";
import { ConfiguracoesPermissoesClient } from "@/app/(protected)/configuracoes/permissoes.client";

export default async function ConfiguracoesPage() {
  // Protege a tela e mantém compatibilidade com os endpoints (admin-geral only).
  await requireAdminGeral();

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

