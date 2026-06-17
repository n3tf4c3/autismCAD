import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { AuthGuard } from "@/auth/AuthGuard";
import { useClinicToday } from "@/hooks/useClinicToday";
import type { EvolutivoReport } from "@/api/types";
import {
  buildComportamentoResumo,
  buildDesempenhoResumo,
  type SkillRow,
} from "@/domain/devolutiva";
import {
  Avatar,
  Button,
  Card,
  Field,
  H2,
  IndicatorCard,
  Label,
  Muted,
  Screen,
  SegmentedToggle,
  theme,
  WeeklyBars,
} from "@/ui";

type Mode = "diario" | "mensal";

const MODE_OPTIONS = [
  { value: "diario" as const, label: "Diario" },
  { value: "mensal" as const, label: "Mensal" },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function fmtDateBr(s: string): string {
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y}`;
}
// Aceita dd/mm/aaaa (ou com - .) e retorna a data, ou null se invalida.
function parseBrDate(input: string): Date | null {
  const m = input.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
// YYYY-MM-DD -> Date local (sem deslocamento de fuso).
function parseYmdLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function fmtHour(value?: string | null): string {
  if (!value) return "-";
  const raw = String(value);
  return /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : raw;
}

export default function Devolutiva() {
  return (
    <AuthGuard area="responsavel">
      <DevolutivaContent />
    </AuthGuard>
  );
}

function DevolutivaContent() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const params = useLocalSearchParams<{ pacienteId?: string; pacienteNome?: string }>();
  const pacienteId = Number(params.pacienteId ?? 0);

  // Espelha a web: Diario = um dia (from=to); Mensal = mes inteiro (1o..ultimo dia).
  const [mode, setMode] = useState<Mode>("diario");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [dayInput, setDayInput] = useState(() => fmtDateBr(ymd(new Date())));
  const [report, setReport] = useState<EvolutivoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Achado 77: ajusta o dia padrao para o "hoje" da clinica (fuso do servidor) caso o
  // usuario ainda nao tenha mudado o dia. So roda uma vez.
  const clinicToday = useClinicToday();
  const didSnapToClinicToday = useRef(false);
  useEffect(() => {
    if (!clinicToday || didSnapToClinicToday.current) return;
    didSnapToClinicToday.current = true;
    const parsed = parseYmdLocal(clinicToday);
    if (parsed) setAnchor((prev) => (ymd(prev) === ymd(new Date()) ? parsed : prev));
  }, [clinicToday]);

  // Mantem o campo de texto em sincronia quando o dia muda pelas setas.
  useEffect(() => {
    setDayInput(fmtDateBr(ymd(anchor)));
  }, [anchor]);

  const periodo = useMemo(() => {
    if (mode === "diario") {
      const day = ymd(anchor);
      return { from: day, to: day, label: fmtDateBr(day) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return {
      from: ymd(first),
      to: ymd(last),
      label: anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  }, [mode, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ report: EvolutivoReport }>("/api/v1/relatorios/evolutivo", {
        query: { pacienteId, from: periodo.from, to: periodo.to },
      });
      setReport(res.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a devolutiva.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, pacienteId, periodo.from, periodo.to]);

  // So carrega depois que a auth hidratou os tokens (evita 401 espurio no cold-start).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  function step(dir: -1 | 1) {
    setAnchor((d) => (mode === "diario" ? addDays(d, dir) : addMonths(d, dir)));
  }

  function consultarDia() {
    const parsed = parseBrDate(dayInput);
    if (!parsed) {
      setError("Data invalida. Use o formato dd/mm/aaaa.");
      return;
    }
    setError(null);
    setAnchor(parsed); // dispara load() via periodo
  }

  const ind = report?.indicadores;
  const desempenho = useMemo(() => buildDesempenhoResumo(report?.evolucoes), [report]);
  const comportamento = useMemo(() => buildComportamentoResumo(report?.evolucoes), [report]);
  const atendimentos = report?.atendimentos ?? [];
  const semDados = !loading && !!report && (ind?.totalAtendimentos ?? 0) === 0;
  const pacienteNome = params.pacienteNome ?? report?.paciente?.nome ?? `Paciente #${pacienteId}`;
  const metaIndep = desempenho.rows.find((r) => r.key === "independente")?.value ?? 0;
  const metaValor = desempenho.total > 0 ? `${metaIndep}/${desempenho.total}` : "—";
  // Atendimentos por semana do mes (4 barras) — derivado dos dados reais, sem tocar no dominio.
  const weeklyData = useMemo(() => {
    const weeks = [0, 0, 0, 0];
    for (const a of report?.atendimentos ?? []) {
      const day = Number(String(a.data ?? "").slice(8, 10));
      if (!day) continue;
      weeks[Math.min(3, Math.floor((day - 1) / 7))] += 1;
    }
    return weeks;
  }, [report]);

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={pacienteNome} size={72} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>{pacienteNome}</Text>
          <Muted>Acompanhamento terapêutico</Muted>
        </View>
      </View>

      {/* Seletor: modo + navegacao + (no diario) campo de dia digitavel */}
      <Card>
        <SegmentedToggle options={MODE_OPTIONS} value={mode} onChange={setMode} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => step(-1)} hitSlop={12} style={navBtnStyle}>
            <Text style={navArrowStyle}>{"◀"}</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600", textTransform: "capitalize" }}>
            {periodo.label}
          </Text>
          <Pressable onPress={() => step(1)} hitSlop={12} style={navBtnStyle}>
            <Text style={navArrowStyle}>{"▶"}</Text>
          </Pressable>
        </View>
        {mode === "diario" ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Dia (dd/mm/aaaa)"
                value={dayInput}
                onChangeText={setDayInput}
                onSubmitEditing={consultarDia}
                placeholder="dd/mm/aaaa"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <View style={{ minWidth: 110 }}>
              <Button title="Consultar dia" onPress={consultarDia} loading={loading} />
            </View>
          </View>
        ) : null}
      </Card>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {loading ? <Muted>Carregando...</Muted> : null}
      {semDados ? <Muted>Sem registros neste {mode === "diario" ? "dia" : "mes"}.</Muted> : null}

      {ind ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <IndicatorCard label="Sessões" value={ind.totalAtendimentos ?? 0} />
          <IndicatorCard label="Presença" value={`${ind.taxaPresencaPercent ?? 0}%`} tone="ok" />
          <IndicatorCard label="Metas" value={metaValor} tone="accent" />
        </View>
      ) : null}

      {mode === "mensal" && atendimentos.length > 0 ? (
        <Card>
          <Label>Engajamento por semana</Label>
          <WeeklyBars data={weeklyData} labels={["S1", "S2", "S3", "S4"]} />
        </Card>
      ) : null}

      {/* Resumo rapido: Independente / Com ajuda / Nao fez */}
      {report ? (
        <Card>
          <Label>Resumo rapido</Label>
          <Muted>{desempenho.total} meta(s) avaliada(s) no periodo.</Muted>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {desempenho.rows.map((row) => (
              <SummaryCard
                key={row.key}
                label={row.label}
                value={row.value}
                pct={row.pct}
                tone={row.key === "independente" ? "ok" : row.key === "ajuda" ? "warn" : "danger"}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {/* Habilidades trabalhadas */}
      {desempenho.rowsBySkill.length > 0 ? (
        <View style={{ gap: 8 }}>
          <H2>Habilidades trabalhadas</H2>
          {desempenho.rowsBySkill.map((skill) => (
            <Card key={skill.key}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.text, fontWeight: "600", flex: 1 }}>{skill.label}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{skill.total} registro(s)</Text>
              </View>
              <StackedBar skill={skill} />
              <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                <Legend color={theme.ok} text={`Independente ${skill.independente} (${skill.pctIndependente}%)`} />
                <Legend color={theme.accent} text={`Com ajuda ${skill.ajuda} (${skill.pctAjuda}%)`} />
                <Legend color={theme.danger} text={`Nao fez ${skill.nao_fez} (${skill.pctNaoFez}%)`} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {/* Grafico de comportamento */}
      {comportamento.total > 0 ? (
        <Card>
          <Label>Grafico de comportamento</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SummaryCard
              label="Negativos"
              value={comportamento.totalNegativo}
              pct={comportamento.pctNegativo}
              tone="danger"
            />
            <SummaryCard
              label="Positivos"
              value={comportamento.totalPositivo}
              pct={comportamento.pctPositivo}
              tone="ok"
            />
            <SummaryCard
              label="Resultado"
              value={`${comportamento.resultado.positivo}/${comportamento.resultado.parcial}/${comportamento.resultado.negativo}`}
              tone="warn"
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>Top comportamentos negativos</Text>
            {comportamento.rowsNegativo.length ? (
              comportamento.rowsNegativo.map((r) => (
                <BehaviorRow key={r.key} label={r.label} value={r.value} pct={r.pct} color={theme.danger} />
              ))
            ) : (
              <Muted>Sem itens negativos registrados.</Muted>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>Top comportamentos positivos</Text>
            {comportamento.rowsPositivo.length ? (
              comportamento.rowsPositivo.map((r) => (
                <BehaviorRow key={r.key} label={r.label} value={r.value} pct={r.pct} color={theme.ok} />
              ))
            ) : (
              <Muted>Sem itens positivos registrados.</Muted>
            )}
          </View>
        </Card>
      ) : null}

      {report?.destaques?.ultimasObservacoes && report.destaques.ultimasObservacoes.length > 0 ? (
        <View style={{ gap: 8 }}>
          <H2>Devolutivas do profissional</H2>
          {report.destaques.ultimasObservacoes.map((o, i) => (
            <Card key={i}>
              <Muted>{fmtDateBr(o.data.slice(0, 10))} · {o.profissional_nome ?? ""}</Muted>
              <Text style={{ color: theme.text, fontSize: 13 }}>{o.texto}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      {/* Atendimentos do dia/periodo */}
      {atendimentos.length > 0 ? (
        <View style={{ gap: 8 }}>
          <H2>Atendimentos ({atendimentos.length})</H2>
          {atendimentos.map((a) => (
            <Card key={a.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>
                  {fmtHour(a.hora_inicio)} - {fmtHour(a.hora_fim)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{a.presenca}</Text>
              </View>
              <Muted>{a.profissional_nome ?? "Profissional"} · {a.duracao_min || "-"} min</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      <Button title="Atualizar" variant="ghost" onPress={load} loading={loading} />
    </Screen>
  );
}

const navBtnStyle = {
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: theme.border,
} as const;

const navArrowStyle = { color: theme.accent, fontSize: 16, fontWeight: "700" } as const;

const TONE_COLOR = { ok: theme.ok, warn: theme.accent, danger: theme.danger } as const;

function SummaryCard({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: number | string;
  pct?: number;
  tone: keyof typeof TONE_COLOR;
}) {
  const color = TONE_COLOR[tone];
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        padding: 10,
        gap: 2,
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color, fontSize: 18, fontWeight: "700" }}>{value}</Text>
      {pct != null ? <Text style={{ color: theme.muted, fontSize: 11 }}>{pct}%</Text> : null}
    </View>
  );
}

function StackedBar({ skill }: { skill: SkillRow }) {
  return (
    <View style={{ flexDirection: "row", height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: theme.border }}>
      {skill.pctIndependente > 0 ? (
        <View style={{ width: `${skill.pctIndependente}%`, backgroundColor: theme.ok }} />
      ) : null}
      {skill.pctAjuda > 0 ? <View style={{ width: `${skill.pctAjuda}%`, backgroundColor: theme.accent }} /> : null}
      {skill.pctNaoFez > 0 ? <View style={{ width: `${skill.pctNaoFez}%`, backgroundColor: theme.danger }} /> : null}
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: theme.muted, fontSize: 11 }}>{text}</Text>
    </View>
  );
}

function BehaviorRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.text, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: theme.muted, fontSize: 12 }}>
          {value} ({pct}%)
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: theme.border }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
      </View>
    </View>
  );
}
