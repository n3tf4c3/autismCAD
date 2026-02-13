"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TerapiaKey = "Convencional" | "Intensiva" | "Especial" | "Intercambio";
type Kind = "foto" | "laudo" | "documento";

export type PacienteFormInitial = {
  id?: number | null;
  nome?: string | null;
  cpf?: string | null;
  sexo?: string | null;
  nascimento?: string | null;
  convenio?: string | null;
  nomeMae?: string | null;
  nomePai?: string | null;
  nomeResponsavel?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  email?: string | null;
  dataInicio?: string | null;
  ativo?: number | boolean | string | null;
  terapias?: string[] | null;
  foto?: string | null;
  laudo?: string | null;
  documento?: string | null;
};

function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatTelefone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length <= 10) {
    const p1 = rest.slice(0, 4);
    const p2 = rest.slice(4);
    return `(${ddd}) ${p1}${p2 ? `-${p2}` : ""}`;
  }
  const p1 = rest.slice(0, 5);
  const p2 = rest.slice(5);
  return `(${ddd}) ${p1}${p2 ? `-${p2}` : ""}`;
}

function ymd(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao salvar paciente";
}

async function readJson(resp: Response): Promise<unknown> {
  return resp.json().catch(() => null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readError(value: unknown): string | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const err = rec.error;
  return typeof err === "string" ? err : null;
}

function readNumber(value: unknown, key: string): number | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const v = rec[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readBoolean(value: unknown, key: string): boolean | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const v = rec[key];
  return typeof v === "boolean" ? v : null;
}

function readString(value: unknown, key: string): string | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const v = rec[key];
  return typeof v === "string" ? v : null;
}

async function openSignedUrl(pacienteId: number, kind: Kind) {
  const resp = await fetch(`/api/pacientes/${pacienteId}/arquivos/read-url?kind=${kind}`, {
    cache: "no-store",
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(readError(data) || "Erro ao abrir arquivo");
  const url = readString(data, "url");
  if (!url) throw new Error("Arquivo nao encontrado");
  window.open(url, "_blank", "noopener,noreferrer");
}

async function presignUpload(pacienteId: number, kind: Kind, file: File) {
  const resp = await fetch(`/api/pacientes/${pacienteId}/arquivos/presign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(readError(data) || "Erro ao preparar upload");
  const key = readString(data, "key");
  const url = readString(data, "url");
  if (!key || !url) throw new Error("Resposta invalida ao preparar upload");
  return { key, url };
}

async function commitKey(pacienteId: number, kind: Kind, key: string | null) {
  const resp = await fetch(`/api/pacientes/${pacienteId}/arquivos/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, key }),
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(readError(data) || "Erro ao salvar referencia do arquivo");
}

function toggleArrayValue(current: string[], value: string, checked: boolean): string[] {
  const set = new Set(current);
  if (checked) set.add(value);
  else set.delete(value);
  return Array.from(set);
}

function labelForKind(kind: Kind): string {
  if (kind === "foto") return "Foto";
  if (kind === "laudo") return "Laudo";
  return "Documento";
}

export function PacienteFormClient(props: {
  mode: "create" | "edit";
  initial?: PacienteFormInitial;
}) {
  const router = useRouter();

  const initialId = props.initial?.id ?? null;
  const [nome, setNome] = useState(String(props.initial?.nome ?? ""));
  const [cpf, setCpf] = useState(formatCpf(String(props.initial?.cpf ?? "")));
  const [sexo, setSexo] = useState(String(props.initial?.sexo ?? ""));
  const [nascimento, setNascimento] = useState(ymd(props.initial?.nascimento ?? null));
  const [convenio, setConvenio] = useState(String(props.initial?.convenio ?? "Particular"));
  const [nomeMae, setNomeMae] = useState(String(props.initial?.nomeMae ?? ""));
  const [nomePai, setNomePai] = useState(String(props.initial?.nomePai ?? ""));
  const [nomeResponsavel, setNomeResponsavel] = useState(String(props.initial?.nomeResponsavel ?? ""));
  const [telefone, setTelefone] = useState(formatTelefone(String(props.initial?.telefone ?? "")));
  const [telefone2, setTelefone2] = useState(formatTelefone(String(props.initial?.telefone2 ?? "")));
  const [email, setEmail] = useState(String(props.initial?.email ?? ""));
  const [dataInicio, setDataInicio] = useState(ymd(props.initial?.dataInicio ?? null));
  const [ativo, setAtivo] = useState(() => {
    const raw = props.initial?.ativo;
    if (raw === 0 || raw === "0" || raw === false) return "0";
    return "1";
  });

  const [terapias, setTerapias] = useState<string[]>(() => props.initial?.terapias ?? []);

  const [fotoAtual, setFotoAtual] = useState<string | null>(props.initial?.foto ?? null);
  const [laudoAtual, setLaudoAtual] = useState<string | null>(props.initial?.laudo ?? null);
  const [documentoAtual, setDocumentoAtual] = useState<string | null>(props.initial?.documento ?? null);

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [laudoFile, setLaudoFile] = useState<File | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const terapiaOptions: Array<{ key: TerapiaKey; label: string }> = useMemo(
    () => [
      { key: "Convencional", label: "Convencional" },
      { key: "Intensiva", label: "Intensiva" },
      { key: "Especial", label: "Especial" },
      { key: "Intercambio", label: "Intercambio" },
    ],
    []
  );

  async function uploadIfSelected(pacienteId: number) {
    const items: Array<{ kind: Kind; file: File; setCurrent: (key: string) => void }> = [];
    if (fotoFile) items.push({ kind: "foto", file: fotoFile, setCurrent: setFotoAtual });
    if (laudoFile) items.push({ kind: "laudo", file: laudoFile, setCurrent: setLaudoAtual });
    if (documentoFile) {
      items.push({ kind: "documento", file: documentoFile, setCurrent: setDocumentoAtual });
    }

    for (const item of items) {
      const { key, url } = await presignUpload(pacienteId, item.kind, item.file);
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": item.file.type || "application/octet-stream" },
        body: item.file,
      });
      if (!put.ok) {
        throw new Error(`Falha no upload de ${labelForKind(item.kind)} (verifique o CORS do R2).`);
      }
      await commitKey(pacienteId, item.kind, key);
      item.setCurrent(key);
    }

    setFotoFile(null);
    setLaudoFile(null);
    setDocumentoFile(null);
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        nome: nome.trim(),
        cpf: digitsOnly(cpf).slice(0, 11),
        nascimento: nascimento || null,
        convenio: convenio || "Particular",
        email: email.trim() || null,
        nomeResponsavel: nomeResponsavel.trim() || null,
        telefone: telefone.trim() || null,
        telefone2: telefone2.trim() || null,
        nomeMae: nomeMae.trim() || null,
        nomePai: nomePai.trim() || null,
        sexo: sexo || null,
        dataInicio: dataInicio || null,
        ativo: ativo === "0" ? 0 : 1,
        terapias,
        fotoAtual,
        laudoAtual,
        documentoAtual,
      };

      if (!payload.nome) throw new Error("Informe o nome do paciente.");
      if (!payload.cpf || payload.cpf.length !== 11) throw new Error("CPF invalido.");
      if (!payload.nomeResponsavel) throw new Error("Informe o nome do responsavel.");
      if (!payload.telefone) throw new Error("Informe o telefone do responsavel.");
      if (!payload.email) throw new Error("Informe o email do responsavel.");
      if (!payload.sexo) throw new Error("Selecione o sexo.");
      if (!payload.nascimento) throw new Error("Informe a data de nascimento.");
      if (!payload.dataInicio) throw new Error("Informe a data de inicio.");

      const isEdit = props.mode === "edit" && !!initialId;
      const resp = await fetch(isEdit ? `/api/pacientes/${initialId}` : "/api/pacientes", {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(resp);
      if (!resp.ok) throw new Error(readError(data) || "Erro ao salvar paciente");

      const id = isEdit ? initialId : readNumber(data, "id");
      if (!id) throw new Error("Resposta invalida: id ausente");

      const reaproveitado = !isEdit ? readBoolean(data, "reaproveitado") : null;
      if (reaproveitado) {
        setMsg("Paciente ja existia (CPF ativo). Cadastro foi atualizado.");
      }

      if (fotoFile || laudoFile || documentoFile) {
        await uploadIfSelected(id);
      }

      setMsg("Paciente salvo com sucesso.");
      setTimeout(() => router.push(`/pacientes/${id}`), 500);
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function openCurrent(kind: Kind) {
    if (!initialId) return;
    setBusy(true);
    setMsg(null);
    try {
      await openSignedUrl(initialId, kind);
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setNome("");
    setCpf("");
    setSexo("");
    setNascimento("");
    setConvenio("Particular");
    setNomeMae("");
    setNomePai("");
    setNomeResponsavel("");
    setTelefone("");
    setTelefone2("");
    setEmail("");
    setDataInicio("");
    setAtivo("1");
    setTerapias([]);
    setFotoFile(null);
    setLaudoFile(null);
    setDocumentoFile(null);
    setMsg(null);
  }

  const isEdit = props.mode === "edit";
  const title = isEdit ? "Editar paciente" : "Novo paciente";
  const submitLabel = isEdit ? "Salvar alteracoes" : "Salvar paciente";

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--marrom)]">Dados do paciente</h1>
          <p className="text-sm text-gray-600">{title}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome completo</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Nome e sobrenome"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">CPF</span>
          <input
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            inputMode="numeric"
            maxLength={14}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="000.000.000-00"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Sexo</span>
          <select
            value={sexo}
            onChange={(e) => setSexo(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          >
            <option value="">Selecione</option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Outro">Outro</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Data de nascimento</span>
          <input
            type="date"
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Convenio do paciente</span>
          <select
            value={convenio}
            onChange={(e) => setConvenio(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          >
            <option value="Particular">Particular</option>
            <option value="Unimed">Unimed</option>
            <option value="Bradesco">Bradesco</option>
            <option value="CASSI">CASSI</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome da mae</span>
          <input
            value={nomeMae}
            onChange={(e) => setNomeMae(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Responsavel materno"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome do pai</span>
          <input
            value={nomePai}
            onChange={(e) => setNomePai(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Responsavel paterno"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome do responsavel</span>
          <input
            value={nomeResponsavel}
            onChange={(e) => setNomeResponsavel(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Quem sera contatado"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Telefone do responsavel</span>
          <input
            value={telefone}
            onChange={(e) => setTelefone(formatTelefone(e.target.value))}
            maxLength={15}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="(00) 00000-0000"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Telefone do responsavel (2)</span>
          <input
            value={telefone2}
            onChange={(e) => setTelefone2(formatTelefone(e.target.value))}
            maxLength={15}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="(00) 00000-0000"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Email do responsavel</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="contato@exemplo.com"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Data de inicio</span>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Status do paciente</span>
            <select
              value={ativo}
              onChange={(e) => setAtivo(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            >
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </label>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-[var(--marrom)]">Tipo de terapia</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {terapiaOptions.map((t) => {
                const checked = terapias.includes(t.key);
                return (
                  <label key={t.key} className="cursor-pointer">
                    <input
                      type="checkbox"
                      className="peer hidden"
                      checked={checked}
                      onChange={(e) =>
                        setTerapias((cur) => toggleArrayValue(cur, t.key, e.target.checked))
                      }
                    />
                    <span className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 peer-checked:border-[var(--laranja)] peer-checked:bg-white peer-checked:text-[var(--marrom)]">
                      {t.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Foto 3x4 (imagem)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFotoFile(e.target.files?.item(0) ?? null)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
            <div className="text-xs text-gray-600">
              {fotoFile ? `Selecionado: ${fotoFile.name}` : null}
              {!fotoFile && fotoAtual && initialId ? (
                <button
                  type="button"
                  className="text-[var(--laranja)] underline"
                  onClick={() => void openCurrent("foto")}
                  disabled={busy}
                >
                  Ver foto atual
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Laudo (PDF)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setLaudoFile(e.target.files?.item(0) ?? null)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
            <div className="text-xs text-gray-600">
              {laudoFile ? `Selecionado: ${laudoFile.name}` : null}
              {!laudoFile && laudoAtual && initialId ? (
                <button
                  type="button"
                  className="text-[var(--laranja)] underline"
                  onClick={() => void openCurrent("laudo")}
                  disabled={busy}
                >
                  Ver laudo atual
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Outro documento</span>
            <input
              type="file"
              onChange={(e) => setDocumentoFile(e.target.files?.item(0) ?? null)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
            <div className="text-xs text-gray-600">
              {documentoFile ? `Selecionado: ${documentoFile.name}` : null}
              {!documentoFile && documentoAtual && initialId ? (
                <button
                  type="button"
                  className="text-[var(--laranja)] underline"
                  onClick={() => void openCurrent("documento")}
                  disabled={busy}
                >
                  Ver documento atual
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 md:col-span-2">
          <button
            type="button"
            onClick={resetForm}
            disabled={busy}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            {busy ? "Salvando..." : submitLabel}
          </button>
        </div>
      </div>

      {msg ? <p className="mt-4 text-sm text-gray-700">{msg}</p> : null}
    </section>
  );
}
