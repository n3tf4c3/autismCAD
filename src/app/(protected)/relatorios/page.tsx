import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";

export default async function RelatoriosIndexPage() {
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
                Selecione um paciente para gerar o Relatorio Evolutivo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--marrom)]">Pacientes</h2>
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

