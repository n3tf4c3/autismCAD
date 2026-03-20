import Link from "next/link";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { listarTerapeutas } from "@/server/modules/profissionais/profissionais.service";
import { AssiduidadeClient } from "@/app/(protected)/relatorios/assiduidade/assiduidade.client";

export default async function RelatorioAssiduidadePage() {
  const { user } = await requirePermission("relatorios_admin:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const canChooseTerapeuta = roleCanon !== "TERAPEUTA";
  let terapeutas: Array<{ id: number; nome: string }> = [];

  if (canChooseTerapeuta) {
    try {
      await requirePermission("terapeutas:view");
      const terapeutasRows = await listarTerapeutas({});
      terapeutas = terapeutasRows.map((item) => ({ id: item.id, nome: item.nome }));
    } catch {
      terapeutas = [];
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Relatorios</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Assiduidade e presenca</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <AssiduidadeClient
        canChooseTerapeuta={canChooseTerapeuta}
        initialTerapeutas={terapeutas}
      />
    </div>
  );
}
