import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { AuthGuard } from "@/auth/AuthGuard";
import type { Atendimento } from "@/api/types";
import { Avatar, Button, Card, DayStrip, Field, Muted, Screen, StatusChip, Sunflower, theme } from "@/ui";

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
function presencaTone(presenca?: string | null): "ok" | "accent" {
  return /presen|confirm/i.test(presenca ?? "") ? "ok" : "accent";
}
function presencaLabel(presenca?: string | null): string {
  return /presen|confirm/i.test(presenca ?? "") ? "Confirmado" : "Pendente";
}

export default function Agenda() {
  return (
    <AuthGuard area="profissional">
      <AgendaContent />
    </AuthGuard>
  );
}

function AgendaContent() {
  const { user, loading: authLoading, authFetch, logout } = useAuth();
  const router = useRouter();
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [dayInput, setDayInput] = useState(() => fmtDateBr(ymd(new Date())));
  const [items, setItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedDay = useMemo(() => ymd(anchor), [anchor]);
  const isToday = selectedDay === ymd(new Date());
  // Tira de 5 dias centrada na data selecionada (anda dia a dia ao tocar nas pontas).
  const stripDays = useMemo(() => [-2, -1, 0, 1, 2].map((n) => addDays(anchor, n)), [anchor]);
  const greeting = useMemo(
    () => anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }),
    [anchor]
  );
  const firstName = (user?.nome ?? "").trim().split(/\s+/)[0] ?? "";

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
      {/* Header: saudacao + nome + avatar do profissional */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.muted, fontSize: 13, textTransform: "capitalize" }}>{greeting}</Text>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>Olá, {firstName}</Text>
        </View>
        <Avatar name={user?.nome} size={46} />
      </View>

      <DayStrip days={stripDays} selected={anchor} onSelect={setAnchor} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>
          {isToday ? "Atendimentos de hoje" : "Atendimentos do dia"}
        </Text>
        <Text style={{ color: theme.accent, fontSize: 17, fontWeight: "800" }}>{items.length}</Text>
      </View>

      {/* Campo de data avancado (saltar para qualquer dia) */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Ir para (dd/mm/aaaa)"
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

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
          <View style={styles_emptyHalo}>
            <Sunflower size={40} />
          </View>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Nenhum atendimento</Text>
          <Muted>Não há atendimentos para {isToday ? "hoje" : "este dia"}.</Muted>
        </View>
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ minWidth: 56 }}>
                  <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "800" }}>{a.horaInicio ?? "--"}</Text>
                  {a.horaFim ? <Text style={{ color: theme.muted, fontSize: 12 }}>{a.horaFim}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>
                    {a.pacienteNome ?? `Paciente #${a.pacienteId ?? "?"}`}
                  </Text>
                  {a.profissionalNome ? <Muted>{a.profissionalNome}</Muted> : null}
                </View>
                <StatusChip label={presencaLabel(a.presenca)} tone={presencaTone(a.presenca)} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

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

const styles_emptyHalo = {
  width: 84,
  height: 84,
  borderRadius: 42,
  backgroundColor: "rgba(245,160,90,0.12)",
  alignItems: "center",
  justifyContent: "center",
} as const;
