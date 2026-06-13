import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import type { EvolutivoReport } from "@/api/types";
import { Button, Card, H1, H2, Label, Muted, Screen, theme } from "@/ui";

export default function Devolutiva() {
  const { authFetch } = useAuth();
  const params = useLocalSearchParams<{ pacienteId?: string; pacienteNome?: string }>();
  const pacienteId = Number(params.pacienteId ?? 0);

  const [report, setReport] = useState<EvolutivoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch<{ report: EvolutivoReport }>("/api/v1/relatorios/evolutivo", {
        query: { pacienteId },
      });
      setReport(res.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a devolutiva.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, pacienteId]);

  useEffect(() => {
    load();
  }, [load]);

  const ind = report?.indicadores;

  return (
    <Screen>
      <H1>Devolutiva</H1>
      <Muted>{params.pacienteNome ?? report?.paciente?.nome ?? `Paciente #${pacienteId}`}</Muted>
      {report?.periodo ? (
        <Muted>Periodo: {report.periodo.from} a {report.periodo.to}</Muted>
      ) : null}

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {loading ? <Muted>Carregando...</Muted> : null}

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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View>
      <Text style={{ color: theme.accent, fontSize: 20, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
