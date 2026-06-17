import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { AuthGuard } from "@/auth/AuthGuard";
import type { PacientesListResponse } from "@autismcad/validators/api/v1";
import { pacientesListResponseSchema } from "@/api/v1-schemas";
import type { Paciente } from "@/api/types";
import { Avatar, Button, Card, Muted, Screen, theme } from "@/ui";

export default function Pacientes() {
  return (
    <AuthGuard area="responsavel">
      <PacientesContent />
    </AuthGuard>
  );
}

function PacientesContent() {
  const { user, authFetch, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch<PacientesListResponse>("/api/v1/pacientes", {
        schema: pacientesListResponseSchema,
      });
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
      {/* Header: titulo + avatar do responsavel */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>Meus pacientes</Text>
          <Text style={{ color: theme.muted, fontSize: 13 }}>Responsável · {user?.nome}</Text>
        </View>
        <Avatar name={user?.nome} size={46} colors={["#7cc0d6", "#69c4ab"]} />
      </View>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={p.nome} size={44} />
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15, flex: 1 }}>{p.nome}</Text>
                <Text style={{ color: theme.muted, fontSize: 22, fontWeight: "700" }}>›</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      {!loading && items.length === 0 ? (
        <View style={styles_emptyDashed}>
          <Muted>Nenhum paciente vinculado.</Muted>
          <Muted>Outros pacientes aparecem aqui quando vinculados pela clínica.</Muted>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Atualizar" variant="ghost" onPress={load} loading={loading} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Sair" variant="ghost" onPress={logout} />
        </View>
      </View>
    </Screen>
  );
}

const styles_emptyDashed = {
  borderWidth: 1,
  borderColor: theme.borderStrong,
  borderStyle: "dashed",
  borderRadius: 16,
  padding: 18,
  gap: 6,
  alignItems: "center",
} as const;
