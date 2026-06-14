import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import type { EvolutivoReport } from "@/api/types";
import { Button, Card, H1, H2, Label, Muted, OptionRow, Screen, theme } from "@/ui";

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

export default function Devolutiva() {
  const { authFetch } = useAuth();
  const params = useLocalSearchParams<{ pacienteId?: string; pacienteNome?: string }>();
  const pacienteId = Number(params.pacienteId ?? 0);

  // Espelha a web: Diario = um dia (from=to); Mensal = mes inteiro (1o..ultimo dia).
  const [mode, setMode] = useState<Mode>("diario");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [report, setReport] = useState<EvolutivoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  function step(dir: -1 | 1) {
    setAnchor((d) => (mode === "diario" ? addDays(d, dir) : addMonths(d, dir)));
  }

  const ind = report?.indicadores;
  const semDados = !loading && !!report && (ind?.totalAtendimentos ?? 0) === 0;

  return (
    <Screen>
      <H1>Devolutiva</H1>
      <Muted>{params.pacienteNome ?? report?.paciente?.nome ?? `Paciente #${pacienteId}`}</Muted>

      {/* Seletor de devolutiva: modo + periodo (como na web) */}
      <Card>
        <OptionRow options={MODE_OPTIONS} value={mode} onChange={setMode} />
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
      </Card>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {loading ? <Muted>Carregando...</Muted> : null}
      {semDados ? <Muted>Sem registros neste {mode === "diario" ? "dia" : "mes"}.</Muted> : null}

      {ind ? (
        <Card>
          <Label>Indicadores</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <Stat label="Atendimentos" value={ind.totalAtendimentos ?? 0} />
            <Stat label="Presentes" value={ind.presentes ?? 0} />
            <Stat label="Ausentes" value={ind.ausentes ?? 0} />
            <Stat label="Presenca" value={`${ind.taxaPresencaPercent ?? 0}%`} />
          </View>
        </Card>
      ) : null}

      {report?.resumoAutomatico?.texto ? (
        <Card>
          <Label>Resumo</Label>
          <Text style={{ color: theme.text, fontSize: 13 }}>{report.resumoAutomatico.texto}</Text>
        </Card>
      ) : null}

      {report?.destaques?.ultimasObservacoes && report.destaques.ultimasObservacoes.length > 0 ? (
        <View style={{ gap: 8 }}>
          <H2>Ultimas observacoes</H2>
          {report.destaques.ultimasObservacoes.map((o, i) => (
            <Card key={i}>
              <Muted>{o.data} · {o.profissional_nome ?? ""}</Muted>
              <Text style={{ color: theme.text, fontSize: 13 }}>{o.texto}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      {report?.evolucoes && report.evolucoes.length > 0 ? (
        <View style={{ gap: 8 }}>
          <H2>Evolucoes</H2>
          {report.evolucoes.map((e) => (
            <Card key={e.id}>
              <Muted>{e.data} · {e.profissional_nome ?? ""}</Muted>
              {e.payload?.titulo ? (
                <Text style={{ color: theme.text, fontWeight: "600" }}>{e.payload.titulo}</Text>
              ) : null}
              {e.payload?.descricao ? (
                <Text style={{ color: theme.text, fontSize: 13 }}>{e.payload.descricao}</Text>
              ) : null}
              {e.payload?.conduta ? (
                <Text style={{ color: theme.muted, fontSize: 12 }}>Conduta: {e.payload.conduta}</Text>
              ) : null}
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View>
      <Text style={{ color: theme.accent, fontSize: 20, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
