import Link from "next/link";
import { requirePermission } from "@/server/auth/auth";
import { listarPacientesPorUsuario } from "@/server/modules/pacientes/pacientes.service";

export default async function ProntuarioIndexPage() {
  const { user } = await requirePermission("prontuario:view");
  const rows = (await listarPacientesPorUsuario(Number(user.id), {})).slice(0, 200);

  return (
    <main className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--marrom)]">Prontuário</h1>
      <p className="mt-1 text-sm text-gray-600">
        Selecione um paciente para abrir a timeline.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
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
