"use client";

import { useEffect, useMemo, useState } from "react";

type BoolTri = "" | "true" | "false";
type AnamneseStatus = "Rascunho" | "Finalizada";

type Anamnese = Record<string, unknown> & {
  paciente_id: number;
  version?: number;
  status?: string;
  created_at?: string;
};

type VersionItem = {
  id: number;
  version: number;
  status: string;
  created_at: string;
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
  comorbidadesFamiliares: string;

  quemPercebeu: string;
  sinaisPercebidos: string;
  idadeDiagnostico: string;
  percepcaoFamilia: string;

  fezTerapia: BoolTri;
  terapias: string;
  frequencia: string;
  atividadesExtras: string;

  gravidezPlanejada: BoolTri;
  intercorrenciasGestacionais: string;
  usoMedicamentos: string;
  tipoParto: string;
  intercorrenciasParto: string;

  marcosMotores: string;
  linguagem: string;
  comunicacao: string;

  escola: string;
  serie: string;
  professor: string;
  acompanhanteEscolar: string;
  observacoesEscolares: string;

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
  comorbidadesFamiliares: "",

  quemPercebeu: "",
  sinaisPercebidos: "",
  idadeDiagnostico: "",
  percepcaoFamilia: "",

  fezTerapia: "",
  terapias: "",
  frequencia: "",
  atividadesExtras: "",

  gravidezPlanejada: "",
  intercorrenciasGestacionais: "",
  usoMedicamentos: "",
  tipoParto: "",
  intercorrenciasParto: "",

  marcosMotores: "",
  linguagem: "",
  comunicacao: "",

  escola: "",
  serie: "",
  professor: "",
  acompanhanteEscolar: "",
  observacoesEscolares: "",

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

function getApiErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const value = rec.error;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function safeJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return {};
  }
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
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
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
      comorbidadesFamiliares: asText(readKey(data, "comorbidadesFamiliares", "comorbidades_familiares")),

      quemPercebeu: asText(readKey(data, "quemPercebeu", "quem_percebeu")),
      sinaisPercebidos: asText(readKey(data, "sinaisPercebidos", "sinais_percebidos")),
      idadeDiagnostico: asText(readKey(data, "idadeDiagnostico", "idade_diagnostico")),
      percepcaoFamilia: asText(readKey(data, "percepcaoFamilia", "percepcao_familia")),

      fezTerapia: asBoolTri(readKey(data, "fezTerapia", "fez_terapia")),
      terapias: asText(readKey(data, "terapias", "terapias")),
      frequencia: asText(readKey(data, "frequencia", "frequencia")),
      atividadesExtras: asText(readKey(data, "atividadesExtras", "atividades_extras")),

      gravidezPlanejada: asBoolTri(readKey(data, "gravidezPlanejada", "gravidez_planejada")),
      intercorrenciasGestacionais: asText(readKey(data, "intercorrenciasGestacionais", "intercorrencias_gestacionais")),
      usoMedicamentos: asText(readKey(data, "usoMedicamentos", "uso_medicamentos")),
      tipoParto: asText(readKey(data, "tipoParto", "tipo_parto")),
      intercorrenciasParto: asText(readKey(data, "intercorrenciasParto", "intercorrencias_parto")),

      marcosMotores: asText(readKey(data, "marcosMotores", "marcos_motores")),
      linguagem: asText(readKey(data, "linguagem", "linguagem")),
      comunicacao: asText(readKey(data, "comunicacao", "comunicacao")),

      escola: asText(readKey(data, "escola", "escola")),
      serie: asText(readKey(data, "serie", "serie")),
      professor: asText(readKey(data, "professor", "professor")),
      acompanhanteEscolar: asText(readKey(data, "acompanhanteEscolar", "acompanhante_escolar")),
      observacoesEscolares: asText(readKey(data, "observacoesEscolares", "observacoes_escolares")),

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
      const [aResp, vResp] = await Promise.all([
        fetch(`/api/anamnese/${pacienteId}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/anamnese/${pacienteId}/versions`, { cache: "no-store", credentials: "include" }),
      ]);

      const [aJson, vJson] = await Promise.all([safeJson(aResp), safeJson(vResp)]);

      if (!aResp.ok && aResp.status !== 404) {
        throw new Error(getApiErrorMessage(aJson) || "Erro ao carregar anamnese");
      }
      if (!vResp.ok) {
        throw new Error(getApiErrorMessage(vJson) || "Erro ao carregar versoes");
      }

      const a = aResp.status === 404 ? null : (aJson as Anamnese);
      setAnamnese(a);
      setVersions(Array.isArray(vJson) ? (vJson as VersionItem[]) : []);
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
        comorbidadesFamiliares: textToJson(form.comorbidadesFamiliares),

        quemPercebeu: textToJson(form.quemPercebeu),
        sinaisPercebidos: textToJson(form.sinaisPercebidos),
        idadeDiagnostico: textToJson(form.idadeDiagnostico),
        percepcaoFamilia: textToJson(form.percepcaoFamilia),

        fezTerapia: boolTriToJson(form.fezTerapia),
        terapias: textToJson(form.terapias),
        frequencia: textToJson(form.frequencia),
        atividadesExtras: textToJson(form.atividadesExtras),

        gravidezPlanejada: boolTriToJson(form.gravidezPlanejada),
        intercorrenciasGestacionais: textToJson(form.intercorrenciasGestacionais),
        usoMedicamentos: textToJson(form.usoMedicamentos),
        tipoParto: textToJson(form.tipoParto),
        intercorrenciasParto: textToJson(form.intercorrenciasParto),

        marcosMotores: textToJson(form.marcosMotores),
        linguagem: textToJson(form.linguagem),
        comunicacao: textToJson(form.comunicacao),

        escola: textToJson(form.escola),
        serie: textToJson(form.serie),
        professor: textToJson(form.professor),
        acompanhanteEscolar: textToJson(form.acompanhanteEscolar),
        observacoesEscolares: textToJson(form.observacoesEscolares),

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

      const resp = await fetch(`/api/anamnese/${pacienteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(getApiErrorMessage(json) || "Erro ao salvar");
      setAnamnese(json as Anamnese);
      await loadAll();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
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
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
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
            <Textarea label="Comorbidades familiares" value={form.comorbidadesFamiliares} rows={3} onChange={(v) => setField("comorbidadesFamiliares", v)} />
          </Section>

          <Section title="Processo Diagnostico">
            <Input label="Quem percebeu os sinais" value={form.quemPercebeu} onChange={(v) => setField("quemPercebeu", v)} />
            <div className="md:col-span-2">
              <Textarea label="O que foi percebido" value={form.sinaisPercebidos} rows={3} onChange={(v) => setField("sinaisPercebidos", v)} />
            </div>
            <Input label="Idade do fechamento do diagnostico" value={form.idadeDiagnostico} onChange={(v) => setField("idadeDiagnostico", v)} />
            <div className="md:col-span-2">
              <Textarea label="Percepcao da familia" value={form.percepcaoFamilia} rows={3} onChange={(v) => setField("percepcaoFamilia", v)} />
            </div>
          </Section>

          <Section title="Acompanhamentos">
            <BoolSelect label="Ja fez terapia antes?" value={form.fezTerapia} onChange={(v) => setField("fezTerapia", v)} />
            <Input label="Terapias" value={form.terapias} onChange={(v) => setField("terapias", v)} />
            <Input label="Frequencia" value={form.frequencia} onChange={(v) => setField("frequencia", v)} />
            <Textarea label="Atividades extras" value={form.atividadesExtras} rows={3} onChange={(v) => setField("atividadesExtras", v)} />
          </Section>

          <Section title="Gestacao e Parto">
            <BoolSelect label="Gravidez planejada?" value={form.gravidezPlanejada} onChange={(v) => setField("gravidezPlanejada", v)} />
            <Textarea label="Intercorrencias gestacionais" value={form.intercorrenciasGestacionais} rows={3} onChange={(v) => setField("intercorrenciasGestacionais", v)} />
            <Textarea label="Uso de medicamentos (gestacao)" value={form.usoMedicamentos} rows={3} onChange={(v) => setField("usoMedicamentos", v)} />
            <Input label="Tipo de parto" value={form.tipoParto} onChange={(v) => setField("tipoParto", v)} />
            <div className="md:col-span-2">
              <Textarea label="Intercorrencias no parto" value={form.intercorrenciasParto} rows={3} onChange={(v) => setField("intercorrenciasParto", v)} />
            </div>
          </Section>

          <Section title="Desenvolvimento">
            <div className="md:col-span-2">
              <Textarea label="Marcos motores" value={form.marcosMotores} rows={3} onChange={(v) => setField("marcosMotores", v)} />
            </div>
            <Textarea label="Linguagem" value={form.linguagem} rows={3} onChange={(v) => setField("linguagem", v)} />
            <Textarea label="Comunicacao" value={form.comunicacao} rows={3} onChange={(v) => setField("comunicacao", v)} />
          </Section>

          <Section title="Escola">
            <Input label="Escola" value={form.escola} onChange={(v) => setField("escola", v)} />
            <Input label="Serie" value={form.serie} onChange={(v) => setField("serie", v)} />
            <Input label="Professor" value={form.professor} onChange={(v) => setField("professor", v)} />
            <Input label="Acompanhante escolar" value={form.acompanhanteEscolar} onChange={(v) => setField("acompanhanteEscolar", v)} />
            <div className="md:col-span-2">
              <Textarea label="Observacoes escolares" value={form.observacoesEscolares} rows={3} onChange={(v) => setField("observacoesEscolares", v)} />
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
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      onClick={async () => {
                        try {
                          const resp = await fetch(`/api/anamnese/${pacienteId}?version=${v.version}`, {
                            cache: "no-store",
                            credentials: "include",
                          });
                          const json = await safeJson(resp);
                          if (!resp.ok) throw new Error(getApiErrorMessage(json) || "Erro ao carregar versao");
                          const data = json as Anamnese;
                          setAnamnese(data);
                          fillFormFrom(data);
                          setError(null);
                        } catch (err) {
                          setError(normalizeApiError(err));
                        }
                      }}
                    >
                      Carregar
                    </button>
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

