import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName, hasPermissionKey } from "@/server/auth/permissions";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { EvolutivoReportClient } from "@/app/(protected)/relatorios/evolutivo/report.client";

export default async function RelatorioEvolutivoPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const { user, access } = await requirePermission("relatorios_clinicos:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  if (isResponsavel) {
    redirect("/relatorios/devolutiva-dia");
  }

  const { pacienteId } = await props.searchParams;
  const parsed = pacienteId ? Number(pacienteId) : null;
  const initialPacienteId = parsed && Number.isFinite(parsed) ? parsed : null;
  const devolutivaDiaHref = initialPacienteId
    ? `/relatorios/devolutiva-dia?pacienteId=${initialPacienteId}`
    : "/relatorios/devolutiva-dia";
  const devolutivaMensalHref = initialPacienteId
    ? `/relatorios/devolutiva-mensal?pacienteId=${initialPacienteId}`
    : "/relatorios/devolutiva-mensal";

  const canExportPdf = hasPermissionKey(access.permissions, "relatorios_clinicos:export");

  const canChooseProfissional = !isResponsavel && roleCanon !== "PROFISSIONAL";
  const canChoosePaciente = !isResponsavel;
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
            <p className="text-sm text-gray-500">Relatório evolutivo</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Relatório Evolutivo</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={devolutivaDiaHref}
              className="rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
            >
              Devolutiva diária
            </Link>
            <Link
              href={devolutivaMensalHref}
              className="rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
            >
              Devolutiva periodo
            </Link>
            <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
              &larr; Voltar
            </Link>
          </div>
        </div>
      </section>

      <EvolutivoReportClient
        initialPacienteId={initialPacienteId}
        canChooseProfissional={canChooseProfissional}
        canChoosePaciente={canChoosePaciente}
        canExportPdf={canExportPdf}
        initialProfissionais={profissionais}
      />
    </div>
  );
}


