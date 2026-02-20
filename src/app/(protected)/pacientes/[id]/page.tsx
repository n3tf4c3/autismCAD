import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacienteTerapia, pacientes, terapias } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { loadUserAccess } from "@/server/auth/access";
import { hasPermissionKey } from "@/server/auth/permissions";
import { toAppError } from "@/server/shared/errors";
import { createSignedReadUrl } from "@/server/storage/r2";
import { PacienteActionsClient } from "@/app/(protected)/pacientes/[id]/paciente-actions.client";

function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatTelefone(value: string | null): string {
  const digits = digitsOnly(String(value || "")).slice(0, 11);
  if (!digits) return "-";
  if (digits.length < 10) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function formatBrDate(value: unknown): string {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "-";
  const [y, m, d] = raw.split("-");
  return `${d}/${m}/${y}`;
}

function ageFromYmd(value: unknown): number | null {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const mm = today.getMonth() + 1;
  const dd = today.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return Number.isFinite(age) ? age : null;
}

async function maybeSignedUrl(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  try {
    return await createSignedReadUrl(stored, 300);
  } catch {
    return null;
  }
}

function resolveAtivoFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["1", "true", "t", "ativo"].includes(parsed)) return true;
    if (["0", "false", "f", "inativo", "arquivado"].includes(parsed)) return false;
  }
  return Boolean(value);
}

export default async function PacienteDetalhePage(props: { params: Promise<{ id: string }> }) {
  const { user } = await requirePermission("pacientes:view");
  const access = await loadUserAccess(Number(user.id));
  const { id } = await props.params;
  const pacienteId = Number(id);

  if (!pacienteId) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente invalido.</p>
      </main>
    );
  }

  try {
    await assertPacienteAccess(user, pacienteId);
  } catch (error) {
    const err = toAppError(error);
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{err.message}</p>
      </main>
    );
  }

  const [paciente] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      convenio: pacientes.convenio,
      dataNascimento: pacientes.dataNascimento,
      dataInicio: pacientes.dataInicio,
      email: pacientes.email,
      telefone: pacientes.telefone,
      telefone2: pacientes.telefone2,
      nomeResponsavel: pacientes.nomeResponsavel,
      nomeMae: pacientes.nomeMae,
      nomePai: pacientes.nomePai,
      sexo: pacientes.sexo,
      ativo: pacientes.ativo,
      foto: pacientes.foto,
      laudo: pacientes.laudo,
      documento: pacientes.documento,
    })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente nao encontrado.</p>
      </main>
    );
  }

  const terapiaRows = await db
    .select({ nome: terapias.nome })
    .from(pacienteTerapia)
    .innerJoin(terapias, eq(terapias.id, pacienteTerapia.terapiaId))
    .where(eq(pacienteTerapia.pacienteId, paciente.id));
  const terapiaNomes = terapiaRows
    .map((r) => r.nome)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));

  const [fotoUrl, laudoUrl, docUrl] = await Promise.all([
    maybeSignedUrl(paciente.foto),
    maybeSignedUrl(paciente.laudo),
    maybeSignedUrl(paciente.documento),
  ]);

  const idade = ageFromYmd(paciente.dataNascimento);
  const nascimentoLabel = paciente.dataNascimento
    ? `${formatBrDate(paciente.dataNascimento)}${idade !== null ? ` (${idade} anos)` : ""}`
    : "-";
  const canArchive = hasPermissionKey(access.permissions, "pacientes:edit");
  const canDelete = hasPermissionKey(access.permissions, "pacientes:delete");
  const pacienteAtivo = resolveAtivoFlag(paciente.ativo);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#fff3dc] via-[#f2f8ff] to-[#e9fbf6] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Paciente</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                  Ficha do paciente
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold text-[var(--marrom)]">{paciente.nome}</h1>
                  <div className="mt-1">
                    <span
                      className={
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold " +
                        (pacienteAtivo
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-gray-50 text-gray-700")
                      }
                    >
                      {pacienteAtivo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="text-right text-sm">
                <p className="font-semibold text-[var(--texto)]">CPF: {formatCpf(paciente.cpf)}</p>
                <p className="font-semibold text-[var(--texto)]">
                  Convenio: {paciente.convenio || "Particular"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/pacientes"
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Voltar
                </Link>
                <Link
                  href={`/anamnese/${paciente.id}`}
                  className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                >
                  Ficha de Anamnese
                </Link>
                <Link
                  href={`/pacientes/${paciente.id}/editar`}
                  className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
                >
                  Editar
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-gray-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prontuario clinico</p>
                <h3 className="text-lg font-bold text-[var(--marrom)]">Historico clinico e Relatorios</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Acesse anamnese, evolucoes, planos e relatorios do paciente.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/prontuario/${paciente.id}`}
                  className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f]"
                >
                  Abrir Prontuario
                </Link>
                <Link
                  href={`/relatorios/evolutivo?pacienteId=${paciente.id}`}
                  className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 font-semibold text-[var(--laranja)] hover:bg-amber-50"
                >
                  Relatorio Evolutivo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <aside>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
              <div className="aspect-[4/5] w-full bg-white">
                {fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoUrl} alt="Foto do paciente" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500">
                    Foto do paciente
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div>
                <p className="font-semibold text-[var(--texto)]">Laudo (PDF)</p>
                {laudoUrl ? (
                  <a
                    href={laudoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[var(--laranja)] hover:underline"
                  >
                    Ver laudo
                  </a>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
              <div>
                <p className="font-semibold text-[var(--texto)]">Outro documento</p>
                {docUrl ? (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[var(--laranja)] hover:underline"
                  >
                    Ver documento
                  </a>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
            </div>
          </aside>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nascimento</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{nascimentoLabel}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Data de inicio</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{formatBrDate(paciente.dataInicio)}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Responsavel</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.nomeResponsavel || "-"}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Telefone do responsavel</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{formatTelefone(paciente.telefone)}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Telefone do responsavel (2)</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{formatTelefone(paciente.telefone2)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.email || "-"}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sexo</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.sexo || "-"}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nome da mae</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.nomeMae || "-"}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nome do pai</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.nomePai || "-"}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Terapias</p>
              <p className="mt-1 text-sm font-semibold text-[var(--texto)]">
                {terapiaNomes.length ? terapiaNomes.join(", ") : "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Acoes administrativas</p>
        <PacienteActionsClient
          pacienteId={paciente.id}
          pacienteNome={paciente.nome}
          ativo={pacienteAtivo}
          canArchive={canArchive}
          canDelete={canDelete}
        />
      </section>
    </div>
  );
}
