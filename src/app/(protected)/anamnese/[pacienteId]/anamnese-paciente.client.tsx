"use client";

import { useEffect, useMemo, useState } from "react";
import {
  carregarAnamneseAction,
  carregarAnamneseVersaoAction,
  excluirAnamneseAction,
  excluirAnamneseVersaoAction,
  salvarAnamneseAction,
  type ActionResult,
} from "./anamnese.actions";

type BoolTri = "" | "true" | "false";
type AnamneseStatus = "Rascunho" | "Finalizada";
type SchoolType = "" | "publica" | "privada";
type SchoolPeriod = "" | "matutino" | "vespertino";

type Anamnese = Record<string, unknown> & {
  paciente_id: number;
  version?: number;
  status?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

type VersionItem = {
  id: number;
  version: number;
  status: string;
  created_at: string | Date;
  payload: Record<string, unknown>;
};

type FormState = {
  status: AnamneseStatus;

  entrevistaPor: string;
  dataEntrevista: string;

  possuiDiagnostico: BoolTri;
  diagnostico: string;
  laudoDiagnostico: string;
  medicoAcompanhante: string;

  fezTerapia: BoolTri;
  terapias: string;
  frequencia: string;

  marcosMotores: string;
  linguagem: string;
  comunicacao: string;

  escola: SchoolType;
  serie: string;
  periodoEscolar: SchoolPeriod;
  acompanhanteEscolar: BoolTri;
  observacoesEscolares: string;
  encaminhamento: string;

  frustracoes: string;
  humor: string;
  estereotipias: string;
  autoagressao: string;
  heteroagressao: string;
  seletividadeAlimentar: string;
  rotinaSono: string;

  medicamentosUsoAnterior: string;
  medicamentosUsoAtual: string;

  dificuldadesFamilia: string;
  expectativasTerapia: string;
};

const DEFAULT_FORM: FormState = {
  status: "Rascunho",

  entrevistaPor: "",
  dataEntrevista: "",

  possuiDiagnostico: "",
  diagnostico: "",
  laudoDiagnostico: "",
  medicoAcompanhante: "",

  fezTerapia: "",
  terapias: "",
  frequencia: "",

  marcosMotores: "",
  linguagem: "",
  comunicacao: "",

  escola: "",
  serie: "",
  periodoEscolar: "",
  acompanhanteEscolar: "",
  observacoesEscolares: "",
  encaminhamento: "",

  frustracoes: "",
  humor: "",
  estereotipias: "",
  autoagressao: "",
  heteroagressao: "",
  seletividadeAlimentar: "",
  rotinaSono: "",

  medicamentosUsoAnterior: "",
  medicamentosUsoAtual: "",

  dificuldadesFamilia: "",
  expectativasTerapia: "",
};

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro na requisicao";
}

function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error || "Erro na requisicao");
  return result.data;
}

function readKey(data: Record<string, unknown> | null | undefined, camel: string, snake: string) {
  if (!data) return undefined;
  const v = data[camel];
  if (v !== undefined) return v;
  return data[snake];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function asDateOnly(value: unknown): string {
  const raw = asText(value).trim();
  if (!raw) return "";
  return raw.split("T")[0] || "";
}

function asBoolTri(value: unknown): BoolTri {
  if (value === true) return "true";
  if (value === false) return "false";
  const raw = asText(value).trim().toLowerCase();
  if (raw === "true") return "true";
  if (raw === "false") return "false";
  return "";
}

function asSchoolPeriod(value: unknown): SchoolPeriod {
  const raw = asText(value).trim().toLowerCase();
  if (raw === "matutino") return "matutino";
  if (raw === "vespertino") return "vespertino";
  return "";
}

function asSchoolType(value: unknown): SchoolType {
  const raw = asText(value).trim().toLowerCase();
  if (raw === "publica" || raw === "pública" || raw.includes("public")) return "publica";
  if (raw === "privada" || raw.includes("privad")) return "privada";
  return "";
}

function boolTriToJson(value: BoolTri): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function textToJson(value: string): string | null {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function Input(props: {
  label: string;
  value: string;
  type?: "text" | "date";
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`text-sm ${props.className ?? ""}`.trim()}>
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <input
        type={props.type ?? "text"}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function Textarea(props: {
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <textarea
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
        value={props.value}
        rows={props.rows ?? 3}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function BoolSelect(props: { label: string; value: BoolTri; onChange: (value: BoolTri) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <select
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as BoolTri)}
      >
        <option value="">Nao informado</option>
        <option value="true">Sim</option>
        <option value="false">Nao</option>
      </select>
    </label>
  );
}

function Checkbox(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-[42px] items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-[var(--laranja)] focus:ring-[var(--laranja)]"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="font-semibold text-[var(--marrom)]">{props.label}</span>
    </label>
  );
}

function ChoiceCheckboxGroup<T extends string>(props: {
  label: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (value: T | "") => void;
  className?: string;
}) {
  return (
    <div className={`text-sm ${props.className ?? ""}`.trim()}>
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <div className="flex flex-wrap gap-3">
        {props.options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={props.value === option.value}
            onChange={() => props.onChange(props.value === option.value ? "" : option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function SchoolTypeField(props: {
  value: SchoolType;
  onChange: (value: SchoolType) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="text-sm md:col-span-2">
      <span className="mb-1 block font-semibold text-[var(--marrom)]">Escola</span>
      <div className="flex flex-wrap gap-3">
        <Checkbox
          label="Escola Pública"
          checked={props.value === "publica"}
          onChange={() => props.onChange(props.value === "publica" ? "" : "publica")}
        />
        <Checkbox
          label="Escola Privada"
          checked={props.value === "privada"}
          onChange={() => props.onChange(props.value === "privada" ? "" : "privada")}
        />
        {props.extra}
      </div>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="rounded-xl border border-gray-200 bg-white" open={props.open}>
      <summary className="cursor-pointer select-none rounded-xl bg-[#fff8ec] px-4 py-3 text-sm font-semibold text-[var(--marrom)]">
        {props.title}
      </summary>
      <div className="grid gap-3 p-4 md:grid-cols-2">{props.children}</div>
    </details>
  );
}

export default function AnamnesePacienteClient(props: { pacienteId: number }) {
  const pacienteId = props.pacienteId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingFicha, setDeletingFicha] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const header = useMemo(() => {
    const ver = anamnese?.version ? `Versao ${anamnese.version}` : "Sem versao";
    const st = anamnese?.status ? `(${anamnese.status})` : "";
    return `${ver} ${st}`.trim();
  }, [anamnese]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  function fillFormFrom(data: Anamnese | null) {
    if (!data) {
      setForm(DEFAULT_FORM);
      return;
    }

    setForm((cur) => ({
      ...cur,
      status: (data.status === "Finalizada" ? "Finalizada" : "Rascunho") as AnamneseStatus,

      entrevistaPor: asText(readKey(data, "entrevistaPor", "entrevista_por")),
      dataEntrevista: asDateOnly(readKey(data, "dataEntrevista", "data_entrevista")),

      possuiDiagnostico: asBoolTri(readKey(data, "possuiDiagnostico", "possui_diagnostico")),
      diagnostico: asText(readKey(data, "diagnostico", "diagnostico")),
      laudoDiagnostico: asText(readKey(data, "laudoDiagnostico", "laudo_diagnostico")),
      medicoAcompanhante: asText(readKey(data, "medicoAcompanhante", "medico_acompanhante")),

      fezTerapia: asBoolTri(readKey(data, "fezTerapia", "fez_terapia")),
      terapias: asText(readKey(data, "terapias", "terapias")),
      frequencia: asText(readKey(data, "frequencia", "frequencia")),

      marcosMotores: asText(readKey(data, "marcosMotores", "marcos_motores")),
      linguagem: asText(readKey(data, "linguagem", "linguagem")),
      comunicacao: asText(readKey(data, "comunicacao", "comunicacao")),

      escola: asSchoolType(readKey(data, "escola", "escola")),
      serie: asText(readKey(data, "serie", "serie")),
      periodoEscolar: asSchoolPeriod(readKey(data, "periodoEscolar", "periodo_escolar")),
      acompanhanteEscolar: asBoolTri(readKey(data, "acompanhanteEscolar", "acompanhante_escolar")),
      observacoesEscolares: asText(readKey(data, "observacoesEscolares", "observacoes_escolares")),
      encaminhamento: asText(readKey(data, "encaminhamento", "encaminhamento")),

      frustracoes: asText(readKey(data, "frustracoes", "frustracoes")),
      humor: asText(readKey(data, "humor", "humor")),
      estereotipias: asText(readKey(data, "estereotipias", "estereotipias")),
      autoagressao: asText(readKey(data, "autoagressao", "autoagressao")),
      heteroagressao: asText(readKey(data, "heteroagressao", "heteroagressao")),
      seletividadeAlimentar: asText(readKey(data, "seletividadeAlimentar", "seletividade_alimentar")),
      rotinaSono: asText(readKey(data, "rotinaSono", "rotina_sono")),

      medicamentosUsoAnterior: asText(readKey(data, "medicamentosUsoAnterior", "medicamentos_uso_anterior")),
      medicamentosUsoAtual: asText(readKey(data, "medicamentosUsoAtual", "medicamentos_uso_atual")),

      dificuldadesFamilia: asText(readKey(data, "dificuldadesFamilia", "dificuldades_familia")),
      expectativasTerapia: asText(readKey(data, "expectativasTerapia", "expectativas_terapia")),
    }));
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const data = unwrapAction(await carregarAnamneseAction(pacienteId));
      const a = (data.anamnese ?? null) as Anamnese | null;
      setAnamnese(a);
      setVersions(Array.isArray(data.versions) ? (data.versions as VersionItem[]) : []);
      fillFormFrom(a);
    } catch (err) {
      setError(normalizeApiError(err));
      setAnamnese(null);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        pacienteId,
        status: form.status,

        entrevistaPor: textToJson(form.entrevistaPor),
        dataEntrevista: textToJson(form.dataEntrevista),

        possuiDiagnostico: boolTriToJson(form.possuiDiagnostico),
        diagnostico: textToJson(form.diagnostico),
        laudoDiagnostico: textToJson(form.laudoDiagnostico),
        medicoAcompanhante: textToJson(form.medicoAcompanhante),

        fezTerapia: boolTriToJson(form.fezTerapia),
        terapias: textToJson(form.terapias),
        frequencia: textToJson(form.frequencia),

        marcosMotores: textToJson(form.marcosMotores),
        linguagem: textToJson(form.linguagem),
        comunicacao: textToJson(form.comunicacao),

        escola: form.escola || null,
        serie: textToJson(form.serie),
        periodoEscolar: form.periodoEscolar || null,
        acompanhanteEscolar: boolTriToJson(form.acompanhanteEscolar),
        observacoesEscolares: textToJson(form.observacoesEscolares),
        encaminhamento: textToJson(form.encaminhamento),

        frustracoes: textToJson(form.frustracoes),
        humor: textToJson(form.humor),
        estereotipias: textToJson(form.estereotipias),
        autoagressao: textToJson(form.autoagressao),
        heteroagressao: textToJson(form.heteroagressao),
        seletividadeAlimentar: textToJson(form.seletividadeAlimentar),
        rotinaSono: textToJson(form.rotinaSono),

        medicamentosUsoAnterior: textToJson(form.medicamentosUsoAnterior),
        medicamentosUsoAtual: textToJson(form.medicamentosUsoAtual),

        dificuldadesFamilia: textToJson(form.dificuldadesFamilia),
        expectativasTerapia: textToJson(form.expectativasTerapia),
      };

      const data = unwrapAction(await salvarAnamneseAction(pacienteId, body));
      setAnamnese(data.anamnese as Anamnese);
      await loadAll();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function loadVersion(version: number) {
    setError(null);
    try {
      const actionData = unwrapAction(await carregarAnamneseVersaoAction(pacienteId, version));
      const data = actionData.anamnese as Anamnese;
      setAnamnese(data);
      fillFormFrom(data);
    } catch (err) {
      setError(normalizeApiError(err));
    }
  }

  async function deleteFicha() {
    if (deletingFicha || deletingVersion !== null) return;

    const ok = window.confirm(
      `Excluir a ficha de anamnese do paciente #${pacienteId}? Esta acao remove toda a ficha e o historico de versoes.`
    );
    if (!ok) return;

    const okFinal = window.confirm("Confirmacao final: deseja realmente excluir esta ficha de anamnese?");
    if (!okFinal) return;

    setDeletingFicha(true);
    setError(null);
    try {
      unwrapAction(await excluirAnamneseAction(pacienteId));
      await loadAll();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setDeletingFicha(false);
    }
  }

  async function deleteVersionItem(version: number) {
    if (deletingFicha || deletingVersion !== null) return;

    const ok = window.confirm(`Excluir a versao ${version} da anamnese?`);
    if (!ok) return;

    setDeletingVersion(version);
    setError(null);
    try {
      unwrapAction(await excluirAnamneseVersaoAction(pacienteId, version));
      await loadAll();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setDeletingVersion(null);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              Anamnese do Paciente #{pacienteId}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{header}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={deletingFicha || deletingVersion !== null}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => void deleteFicha()}
              disabled={deletingFicha || deletingVersion !== null || saving || (!anamnese && !versions.length)}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {deletingFicha ? "Excluindo..." : "Excluir ficha"}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || deletingFicha || deletingVersion !== null}
              className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="mt-3 text-sm text-gray-500">Carregando...</p> : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Status</span>
            <select
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={form.status}
              onChange={(e) => setField("status", e.target.value as AnamneseStatus)}
            >
              <option value="Rascunho">Rascunho</option>
              <option value="Finalizada">Finalizada</option>
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <Section title="Dados Gerais" open>
            <Input label="Entrevista realizada por" value={form.entrevistaPor} onChange={(v) => setField("entrevistaPor", v)} />
            <Input label="Data da entrevista" type="date" value={form.dataEntrevista} onChange={(v) => setField("dataEntrevista", v)} />
          </Section>

          <Section title="Diagnostico">
            <BoolSelect label="Possui diagnostico?" value={form.possuiDiagnostico} onChange={(v) => setField("possuiDiagnostico", v)} />
            <Input label="Qual diagnostico" value={form.diagnostico} onChange={(v) => setField("diagnostico", v)} />
            <div className="md:col-span-2">
              <Textarea label="Laudo (resumo, numero ou profissional)" value={form.laudoDiagnostico} rows={3} onChange={(v) => setField("laudoDiagnostico", v)} />
            </div>
            <Input label="Medico acompanhante" value={form.medicoAcompanhante} onChange={(v) => setField("medicoAcompanhante", v)} />
          </Section>

          <Section title="Acompanhamentos">
            <BoolSelect label="Ja fez terapia antes?" value={form.fezTerapia} onChange={(v) => setField("fezTerapia", v)} />
            <Input label="Terapias" value={form.terapias} onChange={(v) => setField("terapias", v)} />
            <Input label="Frequencia" value={form.frequencia} onChange={(v) => setField("frequencia", v)} />
          </Section>

          <Section title="Desenvolvimento">
            <div className="md:col-span-2">
              <Textarea label="Marcos motores" value={form.marcosMotores} rows={3} onChange={(v) => setField("marcosMotores", v)} />
            </div>
            <Textarea label="Linguagem" value={form.linguagem} rows={3} onChange={(v) => setField("linguagem", v)} />
            <Textarea label="Comunicacao" value={form.comunicacao} rows={3} onChange={(v) => setField("comunicacao", v)} />
          </Section>

          <Section title="Escola">
            <SchoolTypeField
              value={form.escola}
              onChange={(v) => setField("escola", v)}
              extra={
                <div className="flex flex-wrap items-end gap-4 md:ml-4 md:gap-6">
                  <Input
                    label="Série"
                    value={form.serie}
                    onChange={(v) => setField("serie", v)}
                    className="w-full md:w-[180px]"
                  />
                  <ChoiceCheckboxGroup
                    label="Período"
                    value={form.periodoEscolar}
                    options={[
                      { value: "matutino", label: "Matutino" },
                      { value: "vespertino", label: "Vespertino" },
                    ]}
                    onChange={(v) => setField("periodoEscolar", v as SchoolPeriod)}
                  />
                  <ChoiceCheckboxGroup
                    label="Possui acompanhante?"
                    value={form.acompanhanteEscolar}
                    options={[
                      { value: "true", label: "Sim" },
                      { value: "false", label: "Não" },
                    ]}
                    onChange={(v) => setField("acompanhanteEscolar", v as BoolTri)}
                  />
                </div>
              }
            />
            <div className="md:col-span-2">
              <Textarea label="Observacoes escolares" value={form.observacoesEscolares} rows={3} onChange={(v) => setField("observacoesEscolares", v)} />
            </div>
          </Section>

          <Section title="Encaminhamento">
            <div className="md:col-span-2">
              <Textarea label="Encaminhamento" value={form.encaminhamento} rows={4} onChange={(v) => setField("encaminhamento", v)} />
            </div>
          </Section>

          <Section title="Comportamento">
            <Textarea label="Frustracoes" value={form.frustracoes} rows={3} onChange={(v) => setField("frustracoes", v)} />
            <Textarea label="Humor" value={form.humor} rows={3} onChange={(v) => setField("humor", v)} />
            <Textarea label="Estereotipias" value={form.estereotipias} rows={3} onChange={(v) => setField("estereotipias", v)} />
            <Textarea label="Autoagressao" value={form.autoagressao} rows={3} onChange={(v) => setField("autoagressao", v)} />
            <Textarea label="Heteroagressao" value={form.heteroagressao} rows={3} onChange={(v) => setField("heteroagressao", v)} />
            <Textarea label="Seletividade alimentar" value={form.seletividadeAlimentar} rows={3} onChange={(v) => setField("seletividadeAlimentar", v)} />
            <div className="md:col-span-2">
              <Textarea label="Rotina do sono" value={form.rotinaSono} rows={3} onChange={(v) => setField("rotinaSono", v)} />
            </div>
          </Section>

          <Section title="Medicamentos">
            <Textarea label="Medicamentos (uso anterior)" value={form.medicamentosUsoAnterior} rows={3} onChange={(v) => setField("medicamentosUsoAnterior", v)} />
            <Textarea label="Medicamentos (uso atual)" value={form.medicamentosUsoAtual} rows={3} onChange={(v) => setField("medicamentosUsoAtual", v)} />
          </Section>

          <Section title="Familia e Expectativas">
            <Textarea label="Dificuldades da familia" value={form.dificuldadesFamilia} rows={3} onChange={(v) => setField("dificuldadesFamilia", v)} />
            <Textarea label="Expectativas da terapia" value={form.expectativasTerapia} rows={3} onChange={(v) => setField("expectativasTerapia", v)} />
          </Section>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--marrom)]">Versoes</h2>
          <span className="text-sm text-gray-600">{versions.length} item(s)</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Versao</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Criada</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{v.version}</td>
                  <td className="px-3 py-3 text-gray-700">{v.status}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {v.created_at ? new Date(v.created_at).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => void loadVersion(v.version)}
                        disabled={deletingFicha || deletingVersion !== null}
                      >
                        {anamnese?.version === v.version ? "Editando" : "Editar"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        onClick={() => void deleteVersionItem(v.version)}
                        disabled={deletingFicha || deletingVersion !== null}
                      >
                        {deletingVersion === v.version ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!versions.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhuma versao salva.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
