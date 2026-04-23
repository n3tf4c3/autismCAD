import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName, hasPermissionKey } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";
import { DevolutivaImpressaoClient } from "@/app/impressao/devolutiva/devolutiva-impressao.client";

export default async function DevolutivaImpressaoPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const { user, access } = await requirePermission("relatorios_clinicos:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";
  const canExportDocx = hasPermissionKey(access.permissions, "relatorios_clinicos:export");
  const { pacienteId } = await props.searchParams;
  const pacienteIdSelecionado = pacienteId ? Number(pacienteId) : null;

  let pacientesVinculados: Array<{ id: number; nome: string }> = [];
  let pacienteAtivo: { id: number; nome: string } | null = null;
  let outrosPacientes: Array<{ id: number; nome: string }> = [];

  if (isResponsavel) {
    pacientesVinculados = await getPacientesVinculadosByUserId(user.id);
    const pacienteSelecionado = Number.isFinite(pacienteIdSelecionado)
      ? pacientesVinculados.find((item) => Number(item.id) === Number(pacienteIdSelecionado))
      : null;
    pacienteAtivo = pacienteSelecionado ?? pacientesVinculados[0] ?? null;
    outrosPacientes = pacienteAtivo
      ? pacientesVinculados.filter((p) => Number(p.id) !== Number(pacienteAtivo?.id))
      : pacientesVinculados;
  } else {
    if (!Number.isFinite(pacienteIdSelecionado) || Number(pacienteIdSelecionado) <= 0) {
      return (
        <main className="mx-auto max-w-4xl space-y-4 p-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">
              Informe `pacienteId` para abrir o relatório devolutivo para impressão.
            </p>
            <Link
              href="/relatorios/evolutivo"
              className="mt-3 inline-flex text-sm font-semibold text-[var(--laranja)]"
            >
              &larr; Voltar para relatórios
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
        <main className="mx-auto max-w-4xl space-y-4 p-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">{err.message}</p>
            <Link
              href="/relatorios/evolutivo"
              className="mt-3 inline-flex text-sm font-semibold text-[var(--laranja)]"
            >
              &larr; Voltar para relatórios
            </Link>
          </section>
        </main>
      );
    }

    const [row] = await db
      .select({ id: pacientes.id, nome: pacientes.nome })
      .from(pacientes)
      .where(and(eq(pacientes.id, Number(pacienteIdSelecionado)), isNull(pacientes.deletedAt)))
      .limit(1);
    pacienteAtivo = row ?? null;
  }

  return (
    <main className="min-h-screen bg-[#f5f1ec] px-4 py-5 print:bg-white print:px-0 print:py-0 sm:px-6">
      {isResponsavel && !pacientesVinculados.length ? (
        <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">
            Seu perfil ainda não possui paciente vinculado. Solicite ao administrador.
          </p>
        </section>
      ) : null}

      {pacienteAtivo ? (
        <div className="mx-auto max-w-5xl space-y-4">
          <section className="print:hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Relatório devolutivo
                </p>
                <h1 className="mt-2 text-2xl font-bold text-[var(--marrom)]">
                  Versão para impressão, PDF e DOCX
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-gray-600">
                  Layout separado das devolutivas atuais, pensado para imprimir ou salvar em PDF e compartilhar com
                  neuro, psiquiatra e responsaveis. Quando houver permissao de exportacao, tambem sera possível baixar
                  em DOCX.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/relatorios/devolutiva-mensal?pacienteId=${pacienteAtivo.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
                >
                  &larr; Voltar para devolutiva período
                </Link>
              </div>
            </div>

            {isResponsavel && outrosPacientes.length ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {outrosPacientes.map((paciente) => (
                  <Link
                    key={paciente.id}
                    href={`/impressao/devolutiva?pacienteId=${paciente.id}`}
                    className="inline-flex rounded-full border border-gray-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-[var(--laranja)] hover:text-[var(--laranja)]"
                  >
                    {paciente.nome} #{paciente.id}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <DevolutivaImpressaoClient
            pacienteId={pacienteAtivo.id}
            pacienteNome={pacienteAtivo.nome}
            canExportDocx={canExportDocx}
          />
        </div>
      ) : null}
    </main>
  );
}



