import Link from "next/link";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, pacientes, terapeutas } from "@/server/db/schema";

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, (m ?? 1) - 1, 1);
  const end = new Date(y, (m ?? 1), 0);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
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

  const [pendentes, monthDays] = await Promise.all([
    db
      .select({
        id: atendimentos.id,
        data: atendimentos.data,
        hora_inicio: atendimentos.horaInicio,
        hora_fim: atendimentos.horaFim,
        pacienteNome: pacientes.nome,
        terapeutaNome: terapeutas.nome,
        realizado: atendimentos.realizado,
      })
      .from(atendimentos)
      .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
      .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
      .where(and(eq(atendimentos.data, today), isNull(atendimentos.deletedAt)))
      .orderBy(asc(atendimentos.horaInicio), asc(atendimentos.id))
      .limit(10),
    db
      .select({ data: atendimentos.data })
      .from(atendimentos)
      .where(
        and(
          isNull(atendimentos.deletedAt),
          gte(atendimentos.data, startIso),
          lte(atendimentos.data, endIso)
        )
      )
      .groupBy(atendimentos.data),
  ]);

  const pendentesHoje = pendentes.filter((a) => !a.realizado).slice(0, 6);
  const daysWithSessions = monthDays
    .map((r) => String(r.data).slice(0, 10))
    .filter(Boolean);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏠</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Cadastro de Pacientes</h3>
            <p className="text-sm text-gray-600">
              Registre novos pacientes, contatos e perfis terapeuticos.
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
            <p className="text-sm text-gray-600">Busque por nome ou CPF pacientes ja cadastrados.</p>
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
            <h3 className="text-lg font-bold text-[var(--marrom)]">Consultas / Sessoes</h3>
            <p className="text-sm text-gray-600">
              Organize sessoes, confirme presenca e acompanhe evolucoes.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-[var(--marrom)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Pendentes de hoje</p>
            <span className="text-xs text-gray-600">
              {pendentesHoje.length ? `${pendentesHoje.length} itens` : ""}
            </span>
          </div>
          <ul className="max-h-40 space-y-2 overflow-auto pr-1">
            {pendentesHoje.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--marrom)]">
                    {a.pacienteNome}
                  </p>
                  <p className="text-xs text-gray-600">
                    {a.terapeutaNome || "Terapeuta"} · {a.hora_inicio}-{a.hora_fim}
                  </p>
                </div>
                <span className="rounded bg-white px-2 py-1 text-xs text-gray-700">#{a.id}</span>
              </li>
            ))}
            {!pendentesHoje.length ? (
              <li className="text-sm text-gray-600">Nenhuma consulta pendente hoje.</li>
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
            <h3 className="text-lg font-bold text-[var(--marrom)]">Calendario rapido</h3>
            <p className="text-sm text-gray-600">Visao mensal com sessoes marcadas.</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--marrom)]">{ym}</span>
            <span className="text-xs text-gray-600">
              {daysWithSessions.length ? `${daysWithSessions.length} dias` : "Sem sessoes"}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-center text-gray-500">
            <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 text-sm">
            {(() => {
              const [y, m] = ym.split("-").map(Number);
              const first = new Date(y, (m ?? 1) - 1, 1);
              const offset = first.getDay(); // 0..6
              const last = new Date(y, (m ?? 1), 0).getDate();
              const marked = new Set(daysWithSessions.map((d) => Number(d.slice(8, 10))));
              const cells: Array<React.ReactNode> = [];
              for (let i = 0; i < offset; i += 1) cells.push(<div key={`e-${i}`} />);
              for (let day = 1; day <= last; day += 1) {
                const isToday = Number(today.slice(0, 4)) === y && Number(today.slice(5, 7)) === m && Number(today.slice(8, 10)) === day;
                const has = marked.has(day);
                cells.push(
                  <div
                    key={`d-${day}`}
                    className={[
                      "rounded-md border border-gray-200 bg-white px-0.5 py-1 text-center",
                      has ? "border-amber-200" : "",
                      isToday ? "bg-amber-100 font-semibold text-[var(--marrom)]" : "text-gray-700",
                    ].join(" ")}
                    title={has ? "Sessao marcada" : ""}
                  >
                    {day}
                  </div>
                );
              }
              return cells;
            })()}
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--verde)]" />
            <span>Sessao marcada</span>
          </div>
        </div>

        <Link
          className="mt-auto inline-block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
          href="/calendario"
        >
          Abrir Calendario completo
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">📈</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Relatorios</h3>
            <p className="text-sm text-gray-600">
              Indicadores de progresso, assiduidade e evolucao clinica.
            </p>
          </div>
        </div>
        <Link
          href="/relatorios"
          className="mt-auto block w-full rounded-lg bg-[var(--laranja)] py-2.5 text-center font-semibold text-white hover:bg-[#e6961f]"
        >
          Ver Relatorios
        </Link>
      </section>
    </div>
  );
}
