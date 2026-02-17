import Link from "next/link";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, pacientes, terapeutas } from "@/server/db/schema";
import { QuickCalendarClient } from "./quick-calendar.client";

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const year = y || new Date().getFullYear();
  const month1 = m || new Date().getMonth() + 1; // 1..12
  const startIso = `${year}-${String(month1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month1, 0).getDate();
  const endIso = `${year}-${String(month1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startIso, endIso };
}

function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function DashboardPage() {
  const today = ymdToday();
  const ym = ymNow();
  const { startIso, endIso } = monthRange(ym);

  const [pendentes, monthAtendimentos] = await Promise.all([
    db
      .select({
        id: atendimentos.id,
        data: atendimentos.data,
        hora_inicio: atendimentos.horaInicio,
        hora_fim: atendimentos.horaFim,
        pacienteNome: pacientes.nome,
        terapeutaNome: terapeutas.nome,
        realizado: atendimentos.realizado,
        presenca: atendimentos.presenca,
      })
      .from(atendimentos)
      .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
      .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
      .where(and(eq(atendimentos.data, today), isNull(atendimentos.deletedAt)))
      .orderBy(asc(atendimentos.horaInicio), asc(atendimentos.id))
      .limit(60),
    db
      .select({
        id: atendimentos.id,
        data: atendimentos.data,
        hora_inicio: atendimentos.horaInicio,
        hora_fim: atendimentos.horaFim,
        pacienteNome: pacientes.nome,
        terapeutaNome: terapeutas.nome,
        realizado: atendimentos.realizado,
        presenca: atendimentos.presenca,
      })
      .from(atendimentos)
      .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
      .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
      .where(
        and(
          isNull(atendimentos.deletedAt),
          gte(atendimentos.data, startIso),
          lte(atendimentos.data, endIso)
        )
      )
      .orderBy(asc(atendimentos.data), asc(atendimentos.horaInicio), asc(atendimentos.id)),
  ]);

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
          className="mt-auto inline-block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
          href="/pacientes"
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
          className="mt-auto inline-block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
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
          className="mt-auto inline-block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
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
          className="mt-auto inline-block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
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
          className="mt-auto inline-block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
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
          className="mt-auto block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
        >
          Ver Relatórios
        </Link>
      </section>
    </div>
  );
}
