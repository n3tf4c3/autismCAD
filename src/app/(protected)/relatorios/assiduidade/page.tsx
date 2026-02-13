import Link from "next/link";
import { getAuthSession } from "@/server/auth/session";
import { AssiduidadeClient } from "@/app/(protected)/relatorios/assiduidade/assiduidade.client";

export default async function RelatorioAssiduidadePage() {
  const session = await getAuthSession();
  const role = session?.user?.role ?? null;
  const canChooseTerapeuta = String(role || "").toUpperCase() !== "TERAPEUTA";

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

      <AssiduidadeClient canChooseTerapeuta={canChooseTerapeuta} />
    </div>
  );
}

