import { db } from "@/db";
import { idParamSchema } from "@/lib/zod/api";
import { loadUserAccess } from "@/server/auth/access";
import { requireUser } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import { terapeutas } from "@/server/db/schema";
import { obterTerapeutaPorUsuario } from "@/server/modules/terapeutas/terapeutas.service";
import { AppError } from "@/server/shared/errors";
import { eq } from "drizzle-orm";
import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatCpf(cpf: string): string {
  const digits = (cpf || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDateBr(iso?: string | null): string | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function calcAge(iso?: string | null): number | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const hasHadBirthday =
    today.getMonth() + 1 > mo || (today.getMonth() + 1 === mo && today.getDate() >= d);
  if (!hasHadBirthday) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function pickEndereco(row: {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
}) {
  const line1 = [row.logradouro, row.numero].filter(Boolean).join(", ");
  const line2 = [row.bairro, row.cidade].filter(Boolean).join(" · ");
  const line3 = row.cep ? `CEP: ${row.cep}` : "";
  return [line1, line2, line3].filter(Boolean);
}

export default async function TerapeutaDetalhePage(props: PageProps) {
  const user = await requireUser();
  const access = await loadUserAccess(Number(user.id));
  const canView = hasPermissionKey(access.permissions, "terapeutas:view");
  if (!canView) throw new AppError("Acesso negado", 403, "FORBIDDEN");

  const { id } = idParamSchema.parse(await props.params);

  const [row] = await db
    .select({
      id: terapeutas.id,
      nome: terapeutas.nome,
      cpf: terapeutas.cpf,
      nascimento: terapeutas.dataNascimento,
      telefone: terapeutas.telefone,
      email: terapeutas.email,
      especialidade: terapeutas.especialidade,
      logradouro: terapeutas.logradouro,
      numero: terapeutas.numero,
      bairro: terapeutas.bairro,
      cidade: terapeutas.cidade,
      cep: terapeutas.cep,
    })
    .from(terapeutas)
    .where(eq(terapeutas.id, id))
    .limit(1);

  if (!row) throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");

  const canEditAny = hasPermissionKey(access.permissions, "terapeutas:edit");
  const canEditSelf = hasPermissionKey(access.permissions, "terapeutas:edit_self");
  let canEdit = canEditAny;
  if (!canEdit && canEditSelf) {
    const self = await obterTerapeutaPorUsuario(Number(user.id));
    canEdit = Boolean(self && self.id === row.id);
  }

  const nascimentoBr = formatDateBr(row.nascimento);
  const age = calcAge(row.nascimento);
  const enderecoLines = pickEndereco({
    logradouro: row.logradouro,
    numero: row.numero,
    bairro: row.bairro,
    cidade: row.cidade,
    cep: row.cep,
  });

  return (
    <main className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="bg-gradient-to-r from-amber-50 via-white to-sky-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--marrom)] shadow-sm ring-1 ring-black/5">
                Ficha do terapeuta
              </span>
              {row.especialidade ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  {row.especialidade}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">{row.nome}</h1>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="text-right text-sm text-gray-700">
              <p>
                <span className="font-semibold text-[var(--marrom)]">CPF:</span> {formatCpf(row.cpf)}
              </p>
              {row.especialidade ? (
                <p>
                  <span className="font-semibold text-[var(--marrom)]">Especialidade:</span> {row.especialidade}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/terapeutas"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </Link>
              {canEdit ? (
                <Link
                  href={`/terapeutas/${row.id}/editar`}
                  className="rounded-lg bg-[var(--laranja)] px-3 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
                >
                  Editar
                </Link>
              ) : null}
              <Link
                href={`/calendario?terapeutaId=${row.id}`}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Agenda
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">{row.email || "-"}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Telefone</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">{row.telefone || "-"}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nascimento</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">
            {nascimentoBr || "-"}
            {age != null ? <span className="ml-2 text-xs font-semibold text-gray-500">{age} anos</span> : null}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Endereco</p>
          {enderecoLines.length ? (
            <div className="mt-2 space-y-1 text-sm font-semibold text-gray-800">
              {enderecoLines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-gray-800">-</p>
          )}
        </div>
      </div>
    </main>
  );
}

