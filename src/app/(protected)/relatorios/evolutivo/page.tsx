import Link from "next/link";
import { getAuthSession } from "@/server/auth/session";
import { loadUserAccess } from "@/server/auth/access";
import { canonicalRoleName, hasPermissionKey } from "@/server/auth/permissions";
import { getPacienteVinculadoByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { EvolutivoReportClient } from "@/app/(protected)/relatorios/evolutivo/report.client";

export default async function RelatorioEvolutivoPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const session = await getAuthSession();
  const roleCanon = canonicalRoleName(session?.user?.role ?? null) ?? session?.user?.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  const { pacienteId } = await props.searchParams;
  const parsed = pacienteId ? Number(pacienteId) : null;
  let initialPacienteId = parsed && Number.isFinite(parsed) ? parsed : null;

  if (isResponsavel && session?.user?.id) {
    const vinculo = await getPacienteVinculadoByUserId(Number(session.user.id));
    initialPacienteId = vinculo?.id ?? null;
  }

  let canExportPdf = false;
  if (session?.user?.id) {
    const access = await loadUserAccess(Number(session.user.id));
    canExportPdf = hasPermissionKey(access.permissions, "relatorios_clinicos:export");
  }

  const canChooseTerapeuta = !isResponsavel && roleCanon !== "TERAPEUTA";
  const canChoosePaciente = !isResponsavel;

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
        canChoosePaciente={canChoosePaciente}
        canExportPdf={canExportPdf}
      />
    </div>
  );
}

