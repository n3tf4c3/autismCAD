import Link from "next/link";
import { getAuthSession } from "@/server/auth/session";
import { EvolutivoReportClient } from "@/app/(protected)/relatorios/evolutivo/report.client";

export default async function RelatorioEvolutivoPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const session = await getAuthSession();
  const role = session?.user?.role ?? null;
  const canChooseTerapeuta = String(role || "").toUpperCase() !== "TERAPEUTA";

  const { pacienteId } = await props.searchParams;
  const parsed = pacienteId ? Number(pacienteId) : null;
  const initialPacienteId = parsed && Number.isFinite(parsed) ? parsed : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Relatorio evolutivo</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Relatorio Evolutivo</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <EvolutivoReportClient
        initialPacienteId={initialPacienteId}
        canChooseTerapeuta={canChooseTerapeuta}
      />
    </div>
  );
}
