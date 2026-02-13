export default function DashboardPage() {
  return (
    <main className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-bold text-[var(--marrom)]">Painel Principal</h1>
      <p className="mt-2 text-sm text-gray-600">
        Estrutura base autenticada pronta. Modulos estao sendo migrados por fase.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-[var(--marrom)]">Pacientes</p>
          <p className="mt-1 text-xs text-gray-600">Listagem inicial migrada</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <p className="text-sm font-semibold text-[var(--marrom)]">Terapeutas</p>
          <p className="mt-1 text-xs text-gray-600">Listagem inicial migrada</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-[var(--marrom)]">Agenda</p>
          <p className="mt-1 text-xs text-gray-600">Proximo modulo</p>
        </div>
        <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">
          <p className="text-sm font-semibold text-[var(--marrom)]">Prontuario</p>
          <p className="mt-1 text-xs text-gray-600">Em migracao</p>
        </div>
      </div>
    </main>
  );
}
