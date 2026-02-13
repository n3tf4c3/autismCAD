import Link from "next/link";
import { RelatorioClinicoClient } from "@/app/(protected)/relatorios/clinico/clinico.client";

export default function RelatorioClinicoPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Relatorios</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Relatorio Clinico</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <RelatorioClinicoClient />
    </div>
  );
}

