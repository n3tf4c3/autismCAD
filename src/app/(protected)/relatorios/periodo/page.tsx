import Link from "next/link";
import { RelatorioPeriodoClient } from "@/app/(protected)/relatorios/periodo/periodo.client";

export default async function RelatorioPeriodoPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const { pacienteId } = await props.searchParams;
  const parsed = pacienteId ? Number(pacienteId) : null;
  const initialPacienteId = parsed && Number.isFinite(parsed) ? parsed : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Relatorio por periodo</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Consolidado</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <RelatorioPeriodoClient initialPacienteId={initialPacienteId} />
    </div>
  );
}

