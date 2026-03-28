import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { createSignedReadUrl } from "@/server/storage/r2";
import { DevolutivaMensalClient } from "@/app/(protected)/relatorios/devolutiva-mensal/devolutiva-mensal.client";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";
import { ReportsHeader } from "@/components/reports/reports-header";
import { ReportModeToggle } from "@/components/reports/report-mode-toggle";

async function maybeSignedUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  try {
    return await createSignedReadUrl(stored, 300);
  } catch {
    return null;
  }
}

function firstLetter(name: string): string {
  return (name || "").trim().charAt(0).toUpperCase() || "?";
}

export default async function RelatorioDevolutivaMensalPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const { user } = await requirePermission("relatorios_clinicos:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";
  const { pacienteId } = await props.searchParams;
  const pacienteIdSelecionado = pacienteId ? Number(pacienteId) : null;

  let pacientesVinculados: Array<{ id: number; nome: string; foto: string | null }> = [];
  let pacienteAtivo: { id: number; nome: string; foto: string | null } | null = null;
  let outrosPacientes: Array<{ id: number; nome: string; foto: string | null }> = [];

  if (isResponsavel) {
    pacientesVinculados = await getPacientesVinculadosByUserId(user.id);
    const pacienteSelecionado = Number.isFinite(pacienteIdSelecionado)
      ? pacientesVinculados.find((item) => Number(item.id) === Number(pacienteIdSelecionado))
      : null;
    pacienteAtivo = pacienteSelecionado ?? pacientesVinculados[0] ?? null;
    outrosPacientes = pacienteAtivo
      ? pacientesVinculados.filter((p) => Number(p.id) !== Number(pacienteAtivo!.id))
      : pacientesVinculados;
  } else {
    if (!Number.isFinite(pacienteIdSelecionado) || Number(pacienteIdSelecionado) <= 0) {
      return (
        <main className="space-y-3">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-red-600">
              Informe `pacienteId` para abrir a devolutiva periodo a partir do relatorio evolutivo.
            </p>
            <Link href="/relatorios/evolutivo" className="mt-2 inline-flex text-sm font-semibold text-[var(--laranja)]">
              &larr; Ir para relatorio evolutivo
            </Link>
          </section>
        </main>
      );
    }
    try {
      await assertPacienteAccess(user, Number(pacienteIdSelecionado));
    } catch (error) {
      const err = toAppError(error);
      return (
        <main className="space-y-3">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-red-600">{err.message}</p>
            <Link href="/relatorios/evolutivo" className="mt-2 inline-flex text-sm font-semibold text-[var(--laranja)]">
              &larr; Voltar para relatorio evolutivo
            </Link>
          </section>
        </main>
      );
    }

    const [row] = await db
      .select({ id: pacientes.id, nome: pacientes.nome, foto: pacientes.foto })
      .from(pacientes)
      .where(and(eq(pacientes.id, Number(pacienteIdSelecionado)), isNull(pacientes.deletedAt)))
      .limit(1);
    pacienteAtivo = row ?? null;
  }

  const fotoPacienteAtivoUrl = await maybeSignedUrl(pacienteAtivo?.foto);
  const hasPaciente = !!pacienteAtivo;
  const dailyHref = pacienteAtivo ? `/relatorios/devolutiva-dia?pacienteId=${pacienteAtivo.id}` : "/relatorios/devolutiva-dia";
  const monthlyHref = pacienteAtivo
    ? `/relatorios/devolutiva-mensal?pacienteId=${pacienteAtivo.id}`
    : "/relatorios/devolutiva-mensal";
  const backHref = isResponsavel
    ? "/relatorios"
    : pacienteAtivo
      ? `/relatorios/evolutivo?pacienteId=${pacienteAtivo.id}`
      : "/relatorios/evolutivo";

  return (
    <div className="space-y-3">
      {isResponsavel && !pacientesVinculados.length ? (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-red-600">
            Seu perfil ainda não possui paciente vinculado. Solicite ao administrador.
          </p>
        </section>
      ) : (
        <ReportsHeader
          title="Devolutiva periodo"
          subtitle="Visao consolidada por periodo com foco em leitura rapida no celular e comparacao clara entre habilidades."
          modeToggle={<ReportModeToggle mode="monthly" dailyHref={dailyHref} monthlyHref={monthlyHref} />}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {pacienteAtivo ? (
                <Link
                  href={`/impressao/devolutiva?pacienteId=${pacienteAtivo.id}`}
                  target="_blank"
                  className="text-sm font-semibold text-[var(--laranja)]"
                >
                  Versao para impressao
                </Link>
              ) : null}
              <Link href={backHref} className="text-sm font-semibold text-[var(--laranja)]">
                &larr; Voltar
              </Link>
            </div>
          }
          patientSlot={
            pacienteAtivo ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border border-amber-200 bg-white">
                  {fotoPacienteAtivoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoPacienteAtivoUrl} alt={`Foto de ${pacienteAtivo.nome}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--laranja)]">
                      {firstLetter(pacienteAtivo.nome)}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">Paciente ativo</p>
                  <p className="text-base font-semibold text-[var(--marrom)]">
                    {pacienteAtivo.nome} #{pacienteAtivo.id}
                  </p>
                  <p className="hidden text-sm text-gray-700 sm:block">Período selecionado no cliente, com a mesma consolidacao atual.</p>
                </div>
              </div>
            ) : null
          }
          secondarySlot={
            isResponsavel && outrosPacientes.length ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">Trocar paciente</p>
                <div className="flex flex-wrap gap-2">
                  {outrosPacientes.map((paciente) => (
                    <Link
                      key={paciente.id}
                      href={`/relatorios/devolutiva-mensal?pacienteId=${paciente.id}`}
                      className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-[var(--laranja)] hover:text-[var(--laranja)]"
                    >
                      {paciente.nome} #{paciente.id}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null
          }
        />
      )}

      {hasPaciente ? (
        <DevolutivaMensalClient pacienteId={pacienteAtivo.id} pacienteNome={pacienteAtivo.nome} />
      ) : null}
    </div>
  );
}


