import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/auth";
import { assertHasPermission, loadUserAccess } from "@/server/auth/access";
import { ADMIN_ROLES, canonicalRoleName } from "@/server/auth/permissions";
import { loadDashboardAgenda } from "@/server/modules/dashboard/dashboard.service";
import { obterTerapeutaPorUsuario } from "@/server/modules/terapeutas/terapeutas.service";
import { ymNowInClinicTz, ymdNowInClinicTz } from "@/server/shared/clock";
import { QuickCalendarClient } from "./quick-calendar.client";

export default async function DashboardPage() {
  const user = await requireUser();
  const userId = Number(user.id);
  const access = await loadUserAccess(userId);
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  if (roleCanon === "RESPONSAVEL") {
    redirect("/relatorios");
  }
  assertHasPermission(access, ["consultas:view", "atendimentos:view"]);
  const isAdmin = access.roles.some((role) =>
    ADMIN_ROLES.has(canonicalRoleName(role) ?? role)
  );
  const isTerapeuta = access.roles.some(
    (role) => (canonicalRoleName(role) ?? role) === "TERAPEUTA"
  );

  let terapeutaId: number | null = null;
  if (!isAdmin && isTerapeuta) {
    const terapeuta = await obterTerapeutaPorUsuario(userId);
    if (!terapeuta) {
      return (
        <main className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">
            Perfil sem vinculo de terapeuta. Contate o administrador.
          </p>
        </main>
      );
    }
    terapeutaId = terapeuta.id;
  }

  const today = ymdNowInClinicTz();
  const ym = ymNowInClinicTz();
  const { pendentes, monthAtendimentos } = await loadDashboardAgenda({
    terapeutaId,
    today,
    ym,
  });

  const pendentesAll = pendentes.filter((a) => {
    const cancelado = String(a.presenca ?? "").toLowerCase() === "ausente";
    return !a.realizado && !cancelado;
  });
  const pendentesHoje = pendentesAll.slice(0, 6);
  const monthItems = monthAtendimentos.map((a) => ({
    id: Number(a.id),
    data: String(a.data).slice(0, 10),
    hora_inicio: String(a.hora_inicio),
    hora_fim: String(a.hora_fim),
    pacienteNome: a.pacienteNome,
    terapeutaNome: a.terapeutaNome,
    realizado: a.realizado ? 1 : 0,
    presenca: a.presenca,
  }));
  const ctaButtonClass =
    "mt-auto inline-block w-full rounded-lg bg-gradient-to-r from-[var(--laranja)] to-[#ffcc66] py-2.5 text-center font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]/30";

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏠</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Cadastro de Pacientes</h3>
            <p className="text-sm text-gray-600">
              Registre novos pacientes, contatos e perfis terapêuticos.
            </p>
          </div>
        </div>
        <Link
          className={ctaButtonClass}
          href="/pacientes/novo"
        >
          Abrir cadastro
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔎</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Consultar Pacientes</h3>
            <p className="text-sm text-gray-600">Busque por nome ou CPF pacientes já cadastrados.</p>
          </div>
        </div>
        <Link
          className={ctaButtonClass}
          href="/pacientes"
        >
          Abrir consulta
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🧑‍⚕️</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Terapeutas</h3>
            <p className="text-sm text-gray-600">Cadastre profissionais, especialidades e agendas.</p>
          </div>
        </div>
        <Link
          className={ctaButtonClass}
          href="/terapeutas"
        >
          Ver equipe
        </Link>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">📅</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Consultas / Sessões</h3>
            <p className="text-sm text-gray-600">
              Organize sessões, confirme presença e acompanhe evoluções.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-[var(--marrom)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Pendentes de hoje</p>
            <span className="text-xs text-gray-600">
              {pendentesAll.length ? `${pendentesAll.length} restante(s)` : ""}
            </span>
          </div>
          <ul className="max-h-40 space-y-2 overflow-auto pr-1">
            {pendentesHoje.map((a) => {
              const ini = String(a.hora_inicio ?? "").slice(0, 5);
              const fim = String(a.hora_fim ?? "").slice(0, 5);
              const faixa = ini && fim ? `${ini} - ${fim}` : "";

              return (
                <li key={a.id} className="p-2 rounded-md bg-white border border-amber-100 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--marrom)] text-sm">{a.pacienteNome || "Paciente"}</p>
                    {faixa ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-[var(--marrom)] font-semibold">
                        {faixa}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-700">Terapeuta: {a.terapeutaNome || "-"}</p>
                </li>
              );
            })}
            {!pendentesAll.length ? (
              <li className="text-xs text-gray-600">Nenhuma consulta pendente hoje.</li>
            ) : null}
            {pendentesAll.length > pendentesHoje.length ? (
              <li className="text-xs text-gray-600">+{pendentesAll.length - pendentesHoje.length} consulta(s)</li>
            ) : null}
          </ul>
        </div>

        <Link
          href="/consultas"
          className={ctaButtonClass}
        >
          Agenda do dia
        </Link>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">📅</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Calendário rápido</h3>
            <p className="text-sm text-gray-600">Visão mensal com sessões marcadas.</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <QuickCalendarClient initialYm={ym} initialItems={monthItems} />

          <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--verde)]" />
            <span>Sessão marcada</span>
          </div>
        </div>

        <Link
          className={ctaButtonClass}
          href="/calendario"
        >
          Abrir Calendário completo
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">📈</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Relatórios</h3>
            <p className="text-sm text-gray-600">
              Indicadores de progresso, assiduidade e evolução clínica.
            </p>
          </div>
        </div>
        <Link
          href="/relatorios"
          className={ctaButtonClass}
        >
          Ver Relatórios
        </Link>
      </section>
    </div>
  );
}
