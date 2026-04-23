import Link from "next/link";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";

export default async function RelatoriosIndexPage(props: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const { user } = await requirePermission(["relatorios_clinicos:view", "relatorios_admin:view"]);
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  if (isResponsavel) {
    const pacientesVinculados = await getPacientesVinculadosByUserId(user.id);
    return (
      <main className="space-y-4">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Acompanhamento</h1>
          <p className="mt-1 text-sm text-gray-600">
            Acesse os relatórios clínicos dos pacientes vinculados ao seu perfil.
          </p>
          {!pacientesVinculados.length ? (
            <p className="mt-3 text-sm text-red-600">
              Seu perfil ainda não possui paciente vinculado. Solicite ao administrador.
            </p>
          ) : null}
        </section>

        {pacientesVinculados.length ? (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--marrom)]">Devolutivas e plano de ensino</h2>
            <p className="mt-1 text-sm text-gray-600">
              Escolha o paciente para acompanhar devolutivas e gerar o relatório de plano de ensino.
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
                      Devolutiva diária
                    </Link>
                    <Link
                      href={`/relatorios/devolutiva-mensal?pacienteId=${paciente.id}`}
                      className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                    >
                      Devolutiva período
                    </Link>
                    <Link
                      href={`/impressao/plano-ensino?pacienteId=${paciente.id}`}
                      target="_blank"
                      className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                    >
                      Plano de ensino
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

  const { q: queryRaw } = (await props.searchParams) ?? {};
  const query = String(queryRaw || "").trim();
  const queryDigits = Number(query);
  const hasNumericQuery = query !== "" && Number.isInteger(queryDigits) && queryDigits > 0;
  const hasQuery = query.length >= 2 || hasNumericQuery;

  const rows = hasQuery
    ? hasNumericQuery
      ? await db
          .select({ id: pacientes.id, nome: pacientes.nome })
          .from(pacientes)
          .where(and(isNull(pacientes.deletedAt), or(ilike(pacientes.nome, `%${query}%`), eq(pacientes.id, queryDigits))))
          .orderBy(asc(pacientes.nome))
          .limit(20)
      : await db
          .select({ id: pacientes.id, nome: pacientes.nome })
          .from(pacientes)
          .where(and(isNull(pacientes.deletedAt), ilike(pacientes.nome, `%${query}%`)))
          .orderBy(asc(pacientes.nome))
          .limit(20)
    : [];

  return (
    <main className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{"\u{1F4CA}"}</div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--marrom)]">Relatórios</h1>
              <p className="text-sm text-gray-600">
                Acesse indicadores gerais ou gere relatórios por paciente.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--marrom)]">Indicadores gerais</h2>
        <p className="mt-1 text-sm text-gray-600">
          Assiduidade e presença por paciente no período selecionado.
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
        <h2 className="text-lg font-bold text-[var(--marrom)]">Relatórios por paciente</h2>
        <p className="mt-1 text-sm text-gray-600">
          Busque o paciente pelo nome ou ID para abrir o relatório desejado.
        </p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-semibold text-[var(--marrom)]">Buscar paciente</span>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Digite nome ou ID"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f]"
            >
              Buscar
            </button>
            {query ? (
              <Link
                href="/relatorios"
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Limpar
              </Link>
            ) : null}
          </div>
        </form>

        {!query ? (
          <p className="mt-4 text-sm text-gray-500">Nenhum paciente listado por padrão. Use a busca para localizar.</p>
        ) : null}

        {query && !hasQuery ? (
          <p className="mt-4 text-sm text-gray-500">Digite pelo menos 2 caracteres para pesquisar por nome.</p>
        ) : null}

        {hasQuery ? (
          <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">
                    {row.nome} <span className="font-normal text-gray-500">#{row.id}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/relatorios/evolutivo?pacienteId=${row.id}`}
                        className="inline-flex rounded-lg bg-[var(--laranja)] px-3 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
                      >
                        Relatório Evolutivo
                      </Link>
                      <Link
                        href={`/relatorios/devolutiva-dia?pacienteId=${row.id}`}
                        className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                      >
                        Devolutiva diária
                      </Link>
                      <Link
                        href={`/relatorios/devolutiva-mensal?pacienteId=${row.id}`}
                        className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                      >
                        Devolutiva período
                      </Link>
                      <Link
                        href={`/impressao/devolutiva?pacienteId=${row.id}`}
                        target="_blank"
                        className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                      >
                        Relatório para impressão
                      </Link>
                      <Link
                        href={`/impressao/plano-ensino?pacienteId=${row.id}`}
                        target="_blank"
                        className="inline-flex rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
                      >
                        Relatório de plano de ensino
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum paciente encontrado para &quot;{query}&quot;.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}


