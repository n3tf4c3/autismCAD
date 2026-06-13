import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import type { Paciente } from "@/api/types";
import { Button, Card, H1, Muted, Screen, theme } from "@/ui";

export default function Pacientes() {
  const { user, authFetch, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch<{ items: Paciente[] }>("/api/v1/pacientes");
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar pacientes.");
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
        <H1>Pacientes</H1>
        <Button title="Sair" variant="ghost" onPress={logout} />
      </View>
      <Muted>{user?.nome}</Muted>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {!loading && items.length === 0 ? <Muted>Nenhum paciente vinculado.</Muted> : null}

      <View style={{ gap: 10 }}>
        {items.map((p) => (
          <Pressable
            key={p.id}
            onPress={() =>
              router.push({
                pathname: "/devolutiva",
                params: { pacienteId: String(p.id), pacienteNome: p.nome },
              })
            }
          >
            <Card>
              <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>{p.nome}</Text>
              <Text style={{ color: theme.accent, fontSize: 13 }}>Ver devolutiva →</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <Button title="Atualizar" variant="ghost" onPress={load} loading={loading} />
    </Screen>
  );
}
