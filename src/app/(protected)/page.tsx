import Link from "next/link";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/server/auth/auth";
import { assertHasPermission, loadUserAccess } from "@/server/auth/access";
import { ADMIN_ROLES, canonicalRoleName } from "@/server/auth/permissions";
import { pacientes, terapeutas as profissionaisTabela } from "@/server/db/schema";
import { loadDashboardAgenda } from "@/server/modules/dashboard/dashboard.service";
import { obterProfissionalPorUsuario } from "@/server/modules/profissionais/profissionais.service";
import { ymNowInClinicTz, ymdNowInClinicTz } from "@/server/shared/clock";
import { QuickCalendarClient } from "./quick-calendar.client";

type BirthdayItem = {
  id: number;
  nome: string;
  dataNascimento: string;
  dia: number;
  tipo: "Paciente" | "Profissional";
  destaque: string | null;
};

function monthFromYmd(ymd: string): number {
  return Number(String(ymd).slice(5, 7));
}

function formatBirthdayMonth(value: string): string {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "--";
  return raw.slice(5, 7);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const userId = Number(user.id);
  const access = await loadUserAccess(userId);
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  if (roleCanon === "RESPONSAVEL") {
    redirect("/relatorios");
  }
  assertHasPermission(access, ["consultas:view", "atendimentos:view"]);
  const isAdmin = access.roles.some((role) => ADMIN_ROLES.has(canonicalRoleName(role) ?? role));
  const isProfissional = access.roles.some((role) => (canonicalRoleName(role) ?? role) === "PROFISSIONAL");

  let profissionalId: number | null = null;
  if (!isAdmin && isProfissional) {
    const profissional = await obterProfissionalPorUsuario(userId);
    if (!profissional) {
      return (
        <main className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">Perfil sem vinculo de profissional. Contate o administrador.</p>
        </main>
      );
    }
    profissionalId = profissional.id;
  }

  const today = ymdNowInClinicTz();
  const ym = ymNowInClinicTz();
  const birthdayMonth = monthFromYmd(today);

  const [agenda, pacientesAniversariantes, profissionaisAniversariantes] = await Promise.all([
    loadDashboardAgenda({
      profissionalId,
      today,
      ym,
    }),
    db
      .select({
        id: pacientes.id,
        nome: pacientes.nome,
        dataNascimento: pacientes.dataNascimento,
        dia: sql<number>`extract(day from ${pacientes.dataNascimento})::int`,
      })
      .from(pacientes)
      .where(
        and(
          isNull(pacientes.deletedAt),
          eq(pacientes.ativo, true),
          sql`extract(month from ${pacientes.dataNascimento}) = ${birthdayMonth}`
        )
      )
      .orderBy(asc(sql`extract(day from ${pacientes.dataNascimento})`), asc(pacientes.nome)),
    db
      .select({
        id: profissionaisTabela.id,
        nome: profissionaisTabela.nome,
        dataNascimento: profissionaisTabela.dataNascimento,
        dia: sql<number>`extract(day from ${profissionaisTabela.dataNascimento})::int`,
        destaque: profissionaisTabela.especialidade,
      })
      .from(profissionaisTabela)
      .where(
        and(
          isNull(profissionaisTabela.deletedAt),
          eq(profissionaisTabela.ativo, true),
          sql`extract(month from ${profissionaisTabela.dataNascimento}) = ${birthdayMonth}`
        )
      )
      .orderBy(asc(sql`extract(day from ${profissionaisTabela.dataNascimento})`), asc(profissionaisTabela.nome)),
  ]);

  const { pendentes, monthAtendimentos } = agenda;
  const aniversariantes: BirthdayItem[] = [
    ...pacientesAniversariantes.map((item) => ({
      id: Number(item.id),
      nome: item.nome,
      dataNascimento: String(item.dataNascimento ?? "").slice(0, 10),
      dia: Number(item.dia),
      tipo: "Paciente" as const,
      destaque: null,
    })),
    ...profissionaisAniversariantes.map((item) => ({
      id: Number(item.id),
      nome: item.nome,
      dataNascimento: String(item.dataNascimento ?? "").slice(0, 10),
      dia: Number(item.dia),
      tipo: "Profissional" as const,
      destaque: item.destaque ?? null,
    })),
  ].sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));

  const pendentesAll = pendentes.filter((a) => {
    const cancelado = String(a.presenca ?? "").toLowerCase() === "ausente";
    return !a.realizado && !cancelado;
  });
  const pendentesHoje = pendentesAll.slice(0, 6);
  const monthItems = monthAtendimentos.map((a) => ({
    id: Number(a.id),
    data: String(a.data).slice(0, 10),
    horaInicio: String(a.horaInicio),
    horaFim: String(a.horaFim),
    pacienteNome: a.pacienteNome,
    profissionalNome: a.profissionalNome,
    realizado: a.realizado ? 1 : 0,
    presenca: a.presenca,
  }));
  const ctaButtonClass =
    "mt-auto inline-block w-full rounded-lg bg-gradient-to-r from-[var(--laranja)] to-[#ffcc66] py-2.5 text-center font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]/30";

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-[1.35rem] leading-none text-[#9b5c00]">{"\u{1F465}"}</span>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Consultar Pacientes</h3>
            <p className="text-sm text-gray-600">Busque por nome ou CPF pacientes ja cadastrados.</p>
          </div>
        </div>
        <Link className={ctaButtonClass} href="/pacientes">
          Abrir consulta
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-[1.35rem] leading-none text-[#9b5c00]">{"\u{1F466}"}</span>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Cadastro de Pacientes</h3>
            <p className="text-sm text-gray-600">Registre novos pacientes, contatos e perfis profissionais.</p>
          </div>
        </div>
        <Link className={ctaButtonClass} href="/pacientes/novo">
          Abrir cadastro
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-[1.35rem] leading-none text-[#9b5c00]">{"\u{1F9D1}\u200D\u2695\uFE0F"}</span>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Profissionais</h3>
            <p className="text-sm text-gray-600">Cadastre profissionais, especialidades e agendas.</p>
          </div>
        </div>
        <Link className={ctaButtonClass} href="/profissionais">
          Ver equipe
        </Link>
      </section>

      <section className="flex h-full flex-col gap-4 rounded-xl bg-white p-5 shadow-sm xl:h-[540px]">
        <div className="flex items-center gap-3">
          <span className="text-[1.35rem] leading-none text-[#9b5c00]">{"\u{1F50E}"}</span>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Consultas / Sessões</h3>
            <p className="text-sm text-gray-600">Organize sessoes, confirme presenca e acompanhe evolucoes.</p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-[var(--marrom)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Pendentes de hoje</p>
            <span className="text-xs text-gray-600">{pendentesAll.length ? `${pendentesAll.length} restante(s)` : ""}</span>
          </div>
          <ul className="dashboard-pendencias-list max-h-[296px] space-y-2 overflow-y-auto pr-1.5">
            {pendentesHoje.map((a) => {
              const ini = String(a.horaInicio ?? "").slice(0, 5);
              const fim = String(a.horaFim ?? "").slice(0, 5);
              const faixa = ini && fim ? `${ini} - ${fim}` : "";

              return (
                <li key={a.id} className="rounded-md border border-amber-100 bg-white p-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--marrom)]">{a.pacienteNome || "Paciente"}</p>
                    {faixa ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-[var(--marrom)]">
                        {faixa}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-700">Profissional: {a.profissionalNome || "-"}</p>
                </li>
              );
            })}
            {!pendentesAll.length ? <li className="text-xs text-gray-600">Nenhuma consulta pendente hoje.</li> : null}
            {pendentesAll.length > pendentesHoje.length ? (
              <li className="text-xs text-gray-600">+{pendentesAll.length - pendentesHoje.length} consulta(s)</li>
            ) : null}
          </ul>
        </div>

        <Link href="/consultas" className={ctaButtonClass}>
          Agenda do dia
        </Link>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-[1.35rem] leading-none text-[#9b5c00]">{"\u{1F4C5}"}</span>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Calendário rapido</h3>
            <p className="text-sm text-gray-600">Visao mensal com sessoes marcadas.</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <QuickCalendarClient initialYm={ym} initialItems={monthItems} />

          <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--verde)]" />
            <span>Sessão marcada</span>
          </div>
        </div>

        <Link className={ctaButtonClass} href="/calendario">
          Abrir Calendário completo
        </Link>
      </section>

      <section className="birthday-board relative flex h-full flex-col rounded-[28px] p-[1px] shadow-sm xl:h-[540px]">
        <div className="birthday-board__surface relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[27px] border border-white/40 bg-[radial-gradient(circle_at_top,#fff8ee_0%,#fff1d8_38%,#ffe0a0_100%)] p-5">
          <div className="birthday-confetti birthday-confetti--one" />
          <div className="birthday-confetti birthday-confetti--two" />
          <div className="birthday-confetti birthday-confetti--three" />
          <div className="birthday-ribbon" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="birthday-badge flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
                B-DAY
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b97316]">Mural do mes</p>
                <h3 className="text-2xl font-bold text-[#9b5c00]">Aniversariantes</h3>
              </div>
            </div>
            <div className="rounded-full border border-[#f2c66f] bg-white/70 px-3 py-1 text-xs font-semibold text-[#9b5c00] backdrop-blur">
              {aniversariantes.length} no mes
            </div>
          </div>

          <div className="dashboard-pendencias-list relative z-10 mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5">
            {aniversariantes.length ? (
              aniversariantes.map((item, index) => (
                <article
                  key={`${item.tipo}-${item.id}`}
                  className="birthday-card flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/72 px-4 py-3 backdrop-blur"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-[#6b4400]">{item.nome}</p>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                          (item.tipo === "Paciente"
                            ? "bg-[#fff1d6] text-[#a46300]"
                            : "bg-[#e6f5ff] text-[#0b6aa4]")
                        }
                      >
                        {item.tipo}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#8a6a2f]">{item.destaque || "Aniversariante do mes"}</p>
                  </div>
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#fff7e8] text-[#9b5c00] shadow-inner">
                    <span className="text-lg font-black leading-none">{String(item.dia).padStart(2, "0")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide">{formatBirthdayMonth(item.dataNascimento)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex h-full min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-[#f0c980] bg-white/55 px-6 text-center text-sm font-medium text-[#8a6a2f]">
                Nenhum paciente ou profissional faz aniversario neste mes.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

