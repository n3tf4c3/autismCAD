import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { DevolutivaDiaClient } from "@/app/(protected)/relatorios/devolutiva-dia/devolutiva-dia.client";

export default async function RelatorioDevolutivaDiaPage(props: {
  searchParams: Promise<{ pacienteId?: string }>;
}) {
  const { user } = await requirePermission("relatorios_clinicos:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  if (!isResponsavel) {
    redirect("/relatorios");
  }

  const { pacienteId } = await props.searchParams;
  const pacientesVinculados = await getPacientesVinculadosByUserId(Number(user.id));
  const pacienteIdSelecionado = pacienteId ? Number(pacienteId) : null;
  const pacienteSelecionado = Number.isFinite(pacienteIdSelecionado)
    ? pacientesVinculados.find((item) => Number(item.id) === Number(pacienteIdSelecionado))
    : null;
  const pacienteAtivo = pacienteSelecionado ?? pacientesVinculados[0] ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Acompanhamento</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Devolutiva diaria</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      {!pacientesVinculados.length ? (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">
            Seu perfil ainda nao possui paciente vinculado. Solicite ao administrador.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Paciente selecionado</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pacientesVinculados.map((paciente) => {
                const selected = Number(pacienteAtivo?.id) === Number(paciente.id);
                return (
                  <Link
                    key={paciente.id}
                    href={`/relatorios/devolutiva-dia?pacienteId=${paciente.id}`}
                    className={[
                      "inline-flex rounded-lg border px-3 py-2 text-sm font-semibold",
                      selected
                        ? "border-[var(--laranja)] bg-amber-50 text-[var(--laranja)]"
                        : "border-gray-200 bg-white text-gray-700 hover:border-[var(--laranja)] hover:text-[var(--laranja)]",
                    ].join(" ")}
                  >
                    {paciente.nome} #{paciente.id}
                  </Link>
                );
              })}
            </div>
          </section>

          {pacienteAtivo ? (
            <DevolutivaDiaClient pacienteId={pacienteAtivo.id} pacienteNome={pacienteAtivo.nome} />
          ) : null}
        </>
      )}
    </div>
  );
}
