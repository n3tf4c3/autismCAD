import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";

export default async function RelatoriosIndexPage() {
  const { user } = await requirePermission(["relatorios_clinicos:view", "relatorios_admin:view"]);
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  if (isResponsavel) {
    const pacientesVinculados = await getPacientesVinculadosByUserId(Number(user.id));
    return (
      <main className="space-y-4">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Acompanhamento</h1>
          <p className="mt-1 text-sm text-gray-600">
            Acesse os relatorios clinicos dos pacientes vinculados ao seu perfil.
          </p>
          {!pacientesVinculados.length ? (
            <p className="mt-3 text-sm text-red-600">
              Seu perfil ainda nao possui paciente vinculado. Solicite ao administrador.
            </p>
          ) : null}
        </section>

        {pacientesVinculados.length ? (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--marrom)]">Devolutivas (diaria e periodo)</h2>
            <p className="mt-1 text-sm text-gray-600">
              Escolha o paciente para acompanhar desempenho e feedback do profissional.
            </p>
            <ul className="mt-4 space-y-2">
              {pacientesVinculados.map((paciente) => (
                <li
                  key={paciente.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-[var(--marrom)]">{paciente.nome}</span> #{paciente.id}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/relatorios/devolutiva-dia?pacienteId=${paciente.id}`}
                      className="inline-flex rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
                    >
                      Devolutiva diaria
                    </Link>
                    <Link
                      href={`/relatorios/devolutiva-mensal?pacienteId=${paciente.id}`}
                      className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                    >
                      Devolutiva periodo
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    );
  }

  const rows = await db
    .select({ id: pacientes.id, nome: pacientes.nome })
    .from(pacientes)
    .where(isNull(pacientes.deletedAt))
    .orderBy(asc(pacientes.nome))
    .limit(200);

  return (
    <main className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--marrom)]">Relatorios</h1>
              <p className="text-sm text-gray-600">
                Acesse indicadores gerais ou gere relatorios por paciente.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--marrom)]">Indicadores gerais</h2>
        <p className="mt-1 text-sm text-gray-600">
          Assiduidade e presenca por paciente no periodo selecionado.
        </p>
        <div className="mt-4">
          <Link
            href="/relatorios/assiduidade"
            className="inline-flex rounded-lg bg-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f]"
          >
            Abrir Assiduidade
          </Link>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--marrom)]">Relatorio Evolutivo (por paciente)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Gere o relatorio evolutivo por paciente a partir da timeline do prontuario.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">
                    {row.nome} <span className="font-normal text-gray-500">#{row.id}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/relatorios/evolutivo?pacienteId=${row.id}`}
                      className="inline-flex rounded-lg bg-[var(--laranja)] px-3 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
                    >
                      Relatorio Evolutivo
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
