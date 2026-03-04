import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth/session";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacienteVinculadoByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { RelatorioPeriodoClient } from "@/app/(protected)/relatorios/periodo/periodo.client";

export default async function RelatorioPeriodoPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const session = await getAuthSession();
  const roleCanon = canonicalRoleName(session?.user?.role ?? null) ?? session?.user?.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  if (isResponsavel) {
    redirect("/relatorios/devolutiva-dia");
  }

  const { pacienteId } = await props.searchParams;
  const parsed = pacienteId ? Number(pacienteId) : null;
  let initialPacienteId = parsed && Number.isFinite(parsed) ? parsed : null;

  if (isResponsavel && session?.user?.id) {
    const vinculo = await getPacienteVinculadoByUserId(Number(session.user.id));
    initialPacienteId = vinculo?.id ?? null;
  }

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

      <RelatorioPeriodoClient initialPacienteId={initialPacienteId} canChoosePaciente={!isResponsavel} />
    </div>
  );
}
