import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import {
  AJUDA_OPTIONS,
  BEHAVIOR_OPTIONS,
  DESEMPENHO_OPTIONS,
  RESULTADO_OPTIONS,
  TITULO_SESSAO_OPTIONS,
  buildEvolucaoPayload,
  emptyMetaRow,
  type BehaviorItem,
  type MetaRow,
} from "@/domain/evolucao";
import {
  Button,
  Card,
  ErrorText,
  Field,
  H1,
  H2,
  Label,
  Muted,
  OptionRow,
  Screen,
  theme,
} from "@/ui";

export default function EvolucaoForm() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    pacienteId?: string;
    atendimentoId?: string;
    pacienteNome?: string;
  }>();
  const pacienteId = Number(params.pacienteId ?? 0);
  const atendimentoId = params.atendimentoId ? Number(params.atendimentoId) : null;

  const [titulo, setTitulo] = useState("");
  const [tituloCustom, setTituloCustom] = useState(false);
  const [conduta, setConduta] = useState("");
  const [descricao, setDescricao] = useState("");
  const [metaRows, setMetaRows] = useState<MetaRow[]>([emptyMetaRow()]);
  const [compResultado, setCompResultado] = useState("");
  const [negItems, setNegItems] = useState<BehaviorItem[]>([]);
  const [posItems, setPosItems] = useState<BehaviorItem[]>([]);
  const [compDescricao, setCompDescricao] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateMeta(index: number, patch: Partial<MetaRow>) {
    setMetaRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addMeta() {
    setMetaRows((rows) => [...rows, emptyMetaRow()]);
  }
  function removeMeta(index: number) {
    setMetaRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  function addBehavior(tipo: "negativo" | "positivo", value: string, label: string) {
    const setter = tipo === "negativo" ? setNegItems : setPosItems;
    setter((items) =>
      items.some((it) => it.value === value) ? items : [...items, { value, label, qty: 1 }]
    );
  }
  function setBehaviorQty(tipo: "negativo" | "positivo", value: string, qty: number) {
    const setter = tipo === "negativo" ? setNegItems : setPosItems;
    setter((items) => items.map((it) => (it.value === value ? { ...it, qty } : it)));
  }
  function removeBehavior(tipo: "negativo" | "positivo", value: string) {
    const setter = tipo === "negativo" ? setNegItems : setPosItems;
    setter((items) => items.filter((it) => it.value !== value));
  }

  async function onSubmit() {
    setError(null);
    if (!pacienteId) {
      setError("Paciente nao identificado.");
      return;
    }
    setBusy(true);
    try {
      const payload = buildEvolucaoPayload({
        titulo,
        conduta,
        descricao,
        metaRows,
        compResultado,
        negItems,
        posItems,
        compDescricao,
      });
      await authFetch("/api/v1/evolucoes", {
        method: "POST",
        body: { pacienteId, atendimentoId, payload },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao salvar a evolucao.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Nova evolucao</H1>
      <Muted>
        {params.pacienteNome ? params.pacienteNome : `Paciente #${pacienteId}`}
        {atendimentoId ? ` · atendimento #${atendimentoId}` : ""}
      </Muted>

      {/* Identificacao / sessao */}
      <Card>
        <Label>Titulo da sessao</Label>
        <OptionRow
          options={TITULO_SESSAO_OPTIONS.map((t) => ({ value: t, label: t }))}
          value={tituloCustom ? "" : (titulo as (typeof TITULO_SESSAO_OPTIONS)[number] | "")}
          onChange={(v) => {
            setTituloCustom(false);
            setTitulo(v);
          }}
        />
        <Pressable onPress={() => { setTituloCustom(true); setTitulo(""); }}>
          <Text style={{ color: tituloCustom ? theme.accent : theme.muted, fontSize: 13 }}>
            Outro (especifique)
          </Text>
        </Pressable>
        {tituloCustom ? (
          <Field value={titulo} onChangeText={setTitulo} placeholder="Titulo personalizado" />
        ) : null}

        <Field
          label="Conduta / Plano imediato"
          value={conduta}
          onChangeText={setConduta}
          placeholder="Encaminhamentos ou combinados"
          multiline
        />
        <Field
          label="Descricao clinica"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Evolucao da sessao, respostas, pontos de alerta"
          multiline
          style={{ minHeight: 90, textAlignVertical: "top" }}
        />
      </Card>

      {/* Metas / desempenho */}
      <H2>Metas / desempenho da sessao</H2>
      {metaRows.map((row, i) => (
        <Card key={i}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Label>Linha {i + 1}</Label>
            {metaRows.length > 1 ? (
              <Pressable onPress={() => removeMeta(i)}>
                <Text style={{ color: theme.danger, fontSize: 13 }}>Remover</Text>
              </Pressable>
            ) : null}
          </View>
          <Field label="Ensino" value={row.ensino} onChangeText={(v) => updateMeta(i, { ensino: v })} placeholder="Ex: Imitacao, Ecoico" />
          <Field label="Habilidade" value={row.habilidade} onChangeText={(v) => updateMeta(i, { habilidade: v })} placeholder="Ex: Nomeacao, Pareamento" />
          <Field label="Alvo" value={row.opcao} onChangeText={(v) => updateMeta(i, { opcao: v })} placeholder="Ex: Gato, Cachorro" />
          <Label>Desempenho</Label>
          <OptionRow
            options={DESEMPENHO_OPTIONS}
            value={row.desempenho as (typeof DESEMPENHO_OPTIONS)[number]["value"] | ""}
            onChange={(v) => updateMeta(i, { desempenho: v })}
          />
          <Label>Tipo de ajuda</Label>
          <OptionRow
            options={AJUDA_OPTIONS}
            value={row.tipoAjuda as (typeof AJUDA_OPTIONS)[number]["value"] | ""}
            onChange={(v) => updateMeta(i, { tipoAjuda: v })}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Tentativas" value={row.tentativas} onChangeText={(v) => updateMeta(i, { tentativas: v })} keyboardType="number-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Acertos" value={row.acertos} onChangeText={(v) => updateMeta(i, { acertos: v })} keyboardType="number-pad" placeholder="0" />
            </View>
          </View>
          <Field label="Reforcador" value={row.reforcador} onChangeText={(v) => updateMeta(i, { reforcador: v })} placeholder="Ex: bola" />
        </Card>
      ))}
      <Button title="+ Adicionar linha" variant="ghost" onPress={addMeta} />

      {/* Comportamentos */}
      <H2>Comportamentos observados</H2>
      <Card>
        <Label>Resultado geral</Label>
        <OptionRow
          options={RESULTADO_OPTIONS}
          value={compResultado as (typeof RESULTADO_OPTIONS)[number]["value"] | ""}
          onChange={(v) => setCompResultado(v)}
        />

        <BehaviorPicker
          titulo="Negativos"
          tipo="negativo"
          options={BEHAVIOR_OPTIONS.negativo}
          selected={negItems}
          onAdd={addBehavior}
          onQty={setBehaviorQty}
          onRemove={removeBehavior}
        />
        <BehaviorPicker
          titulo="Positivos"
          tipo="positivo"
          options={BEHAVIOR_OPTIONS.positivo}
          selected={posItems}
          onAdd={addBehavior}
          onQty={setBehaviorQty}
          onRemove={removeBehavior}
        />

        <Field
          label="Descricao do comportamento"
          value={compDescricao}
          onChangeText={setCompDescricao}
          placeholder="Contexto, frequencia, antecedentes, consequencias"
          multiline
          style={{ minHeight: 70, textAlignVertical: "top" }}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Salvar evolucao" onPress={onSubmit} loading={busy} />
    </Screen>
  );
}

function BehaviorPicker({
  titulo,
  tipo,
  options,
  selected,
  onAdd,
  onQty,
  onRemove,
}: {
  titulo: string;
  tipo: "negativo" | "positivo";
  options: readonly { value: string; label: string }[];
  selected: BehaviorItem[];
  onAdd: (tipo: "negativo" | "positivo", value: string, label: string) => void;
  onQty: (tipo: "negativo" | "positivo", value: string, qty: number) => void;
  onRemove: (tipo: "negativo" | "positivo", value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Label>Comportamentos {titulo}</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const active = selected.some((s) => s.value === o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => (active ? onRemove(tipo, o.value) : onAdd(tipo, o.value, o.label))}
              style={{
                borderWidth: 1,
                borderColor: active ? theme.accent : theme.border,
                backgroundColor: active ? theme.accent : "transparent",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: active ? theme.accentText : theme.text, fontSize: 12 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected.map((it) => (
        <View key={it.value} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: theme.text, flex: 1, fontSize: 13 }}>{it.label}</Text>
          <Field
            value={String(it.qty)}
            onChangeText={(v) => onQty(tipo, it.value, Math.max(1, Number(v) || 1))}
            keyboardType="number-pad"
            style={{ width: 64 }}
          />
          <Pressable onPress={() => onRemove(tipo, it.value)}>
            <Text style={{ color: theme.danger, fontSize: 13 }}>x</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
