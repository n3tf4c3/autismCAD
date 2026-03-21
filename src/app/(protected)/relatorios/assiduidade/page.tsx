import Link from "next/link";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { AssiduidadeClient } from "@/app/(protected)/relatorios/assiduidade/assiduidade.client";

export default async function RelatorioAssiduidadePage() {
  const { user } = await requirePermission("relatorios_admin:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const canChooseProfissional = roleCanon !== "PROFISSIONAL";
  let profissionais: Array<{ id: number; nome: string }> = [];

  if (canChooseProfissional) {
    try {
      await requirePermission("profissionais:view");
      const profissionaisRows = await listarProfissionais({});
      profissionais = profissionaisRows.map((item) => ({ id: item.id, nome: item.nome }));
    } catch {
      profissionais = [];
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Relatórios</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Assiduidade e presença</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <AssiduidadeClient
        canChooseProfissional={canChooseProfissional}
        initialProfissionais={profissionais}
      />
    </div>
  );
}


