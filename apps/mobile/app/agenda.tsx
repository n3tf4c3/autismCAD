import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import type { Atendimento } from "@/api/types";
import { Button, Card, Field, H1, Muted, Screen, theme } from "@/ui";

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
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

export default function Agenda() {
  const { user, loading: authLoading, authFetch, logout } = useAuth();
  const router = useRouter();
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [dayInput, setDayInput] = useState(() => fmtDateBr(ymd(new Date())));
  const [items, setItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedDay = useMemo(() => ymd(anchor), [anchor]);
  const isToday = selectedDay === ymd(new Date());

  // Mantem o campo de texto em sincronia quando o dia muda pelas setas.
  useEffect(() => {
    setDayInput(fmtDateBr(selectedDay));
  }, [selectedDay]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ items: Atendimento[] }>("/api/v1/atendimentos", {
        query: { data: selectedDay },
      });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedDay]);

  // So carrega depois que a auth hidratou os tokens do SecureStore, evitando 401
  // espurio ("Nao autenticado") no cold-start antes do token estar disponivel.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  function step(dir: -1 | 1) {
    setAnchor((d) => addDays(d, dir));
  }

  function consultarDia() {
    const parsed = parseBrDate(dayInput);
    if (!parsed) {
      setError("Data invalida. Use o formato dd/mm/aaaa.");
      return;
    }
    setError(null);
    setAnchor(parsed); // dispara load() via selectedDay
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <H1>Agenda</H1>
        <Button title="Sair" variant="ghost" onPress={logout} />
      </View>
      <Muted>{user?.nome}</Muted>

      {/* Seletor de dia: setas + campo dd/mm/aaaa */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => step(-1)} hitSlop={12} style={navBtnStyle}>
            <Text style={navArrowStyle}>{"◀"}</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
            {fmtDateBr(selectedDay)}
            {isToday ? "  (hoje)" : ""}
          </Text>
          <Pressable onPress={() => step(1)} hitSlop={12} style={navBtnStyle}>
            <Text style={navArrowStyle}>{"▶"}</Text>
          </Pressable>
        </View>
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
          <View style={{ minWidth: 100 }}>
            <Button title="Consultar" onPress={consultarDia} loading={loading} />
          </View>
        </View>
        {!isToday ? (
          <Button title="Voltar para hoje" variant="ghost" onPress={() => setAnchor(new Date())} />
        ) : null}
      </Card>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {!loading && items.length === 0 ? (
        <Muted>Nenhum atendimento para {isToday ? "hoje" : "este dia"}.</Muted>
      ) : null}

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

const navBtnStyle = {
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: theme.border,
} as const;

const navArrowStyle = { color: theme.accent, fontSize: 16, fontWeight: "700" } as const;
