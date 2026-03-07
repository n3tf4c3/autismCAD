import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { createSignedReadUrl } from "@/server/storage/r2";
import { DevolutivaDiaClient } from "@/app/(protected)/relatorios/devolutiva-dia/devolutiva-dia.client";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";

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

export default async function RelatorioDevolutivaDiaPage(props: {
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
    pacientesVinculados = await getPacientesVinculadosByUserId(Number(user.id));
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
              Informe `pacienteId` para abrir a devolutiva diaria a partir do relatorio evolutivo.
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

  return (
    <div className="space-y-3">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        {isResponsavel && !pacientesVinculados.length ? (
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
              {isResponsavel && outrosPacientes.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">Trocar:</span>
                  {outrosPacientes.map((paciente) => (
                    <Link
                      key={paciente.id}
                      href={`/relatorios/devolutiva-dia?pacienteId=${paciente.id}`}
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
                href={pacienteAtivo ? `/relatorios/devolutiva-mensal?pacienteId=${pacienteAtivo.id}` : "/relatorios/devolutiva-mensal"}
                className="text-sm font-semibold text-[var(--laranja)]"
              >
                Relatorio mensal
              </Link>
              <Link
                href={isResponsavel ? "/relatorios" : (pacienteAtivo ? `/relatorios/evolutivo?pacienteId=${pacienteAtivo.id}` : "/relatorios/evolutivo")}
                className="text-sm font-semibold text-[var(--laranja)]"
              >
                &larr; Voltar
              </Link>
            </div>
          </div>
        )}
      </section>

      {hasPaciente ? (
        <DevolutivaDiaClient pacienteId={pacienteAtivo.id} pacienteNome={pacienteAtivo.nome} />
      ) : null}
    </div>
  );
}
