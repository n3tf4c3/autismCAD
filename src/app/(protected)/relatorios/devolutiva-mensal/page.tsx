import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { createSignedReadUrl } from "@/server/storage/r2";
import { DevolutivaMensalClient } from "@/app/(protected)/relatorios/devolutiva-mensal/devolutiva-mensal.client";

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
  const fotoPacienteAtivoUrl = await maybeSignedUrl(pacienteAtivo?.foto);
  const outrosPacientes = pacienteAtivo
    ? pacientesVinculados.filter((p) => Number(p.id) !== Number(pacienteAtivo.id))
    : pacientesVinculados;

  return (
    <div className="space-y-3">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        {!pacientesVinculados.length ? (
          <p className="text-sm text-red-600">
            Seu perfil ainda nao possui paciente vinculado. Solicite ao administrador.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {pacienteAtivo ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5">
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-amber-200 bg-white">
                    {fotoPacienteAtivoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotoPacienteAtivoUrl}
                        alt={`Foto de ${pacienteAtivo.nome}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--laranja)]">
                        {firstLetter(pacienteAtivo.nome)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-[var(--marrom)]">
                    {pacienteAtivo.nome} #{pacienteAtivo.id}
                  </span>
                </div>
              ) : null}
              {outrosPacientes.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">Trocar:</span>
                  {outrosPacientes.map((paciente) => (
                    <Link
                      key={paciente.id}
                      href={`/relatorios/devolutiva-mensal?pacienteId=${paciente.id}`}
                      className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-[var(--laranja)] hover:text-[var(--laranja)]"
                    >
                      {paciente.nome} #{paciente.id}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={pacienteAtivo ? `/relatorios/devolutiva-dia?pacienteId=${pacienteAtivo.id}` : "/relatorios/devolutiva-dia"}
                className="text-sm font-semibold text-[var(--laranja)]"
              >
                Devolutiva diaria
              </Link>
              <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
                &larr; Voltar
              </Link>
            </div>
          </div>
        )}
      </section>

      {pacientesVinculados.length && pacienteAtivo ? (
        <DevolutivaMensalClient pacienteId={pacienteAtivo.id} pacienteNome={pacienteAtivo.nome} />
      ) : null}
    </div>
  );
}
