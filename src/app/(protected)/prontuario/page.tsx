import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";

export default async function ProntuarioIndexPage() {
  const rows = await db
    .select({ id: pacientes.id, nome: pacientes.nome })
    .from(pacientes)
    .where(isNull(pacientes.deletedAt))
    .orderBy(asc(pacientes.nome))
    .limit(200);

  return (
    <main className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--marrom)]">Prontuario</h1>
      <p className="mt-1 text-sm text-gray-600">
        Selecione um paciente para abrir a timeline.
      </p>

      <div className="mt-5 overflow-x-auto">
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
                    href={`/prontuario/${row.id}`}
                    className="inline-flex rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Abrir
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
    </main>
  );
}

