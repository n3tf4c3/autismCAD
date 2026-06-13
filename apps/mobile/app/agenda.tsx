import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import type { Atendimento } from "@/api/types";
import { Button, Card, H1, Muted, Screen, theme } from "@/ui";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function Agenda() {
  const { user, authFetch, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch<{ items: Atendimento[] }>("/api/v1/atendimentos", {
        query: { data: todayYmd() },
      });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <H1>Agenda</H1>
        <Button title="Sair" variant="ghost" onPress={logout} />
      </View>
      <Muted>{user?.nome} — {todayYmd()}</Muted>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {!loading && items.length === 0 ? <Muted>Nenhum atendimento para hoje.</Muted> : null}

      <View style={{ gap: 10 }}>
        {items.map((a) => (
          <Pressable
            key={a.id}
            onPress={() =>
              router.push({
                pathname: "/evolucao",
                params: {
                  pacienteId: String(a.pacienteId ?? ""),
                  atendimentoId: String(a.id),
                  pacienteNome: a.pacienteNome ?? "",
                },
              })
            }
          >
            <Card>
              <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>
                {a.pacienteNome ?? `Paciente #${a.pacienteId ?? "?"}`}
              </Text>
              <Muted>
                {(a.horaInicio ?? "--")}{a.horaFim ? ` - ${a.horaFim}` : ""} · {a.profissionalNome ?? ""}
              </Muted>
              <Text style={{ color: theme.accent, fontSize: 13 }}>Registrar evolucao →</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <Button title="Atualizar" variant="ghost" onPress={load} loading={loading} />
    </Screen>
  );
}
