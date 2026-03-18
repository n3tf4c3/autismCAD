"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { savePacienteSchema } from "@/server/modules/pacientes/pacientes.schema";
import {
  commitArquivoPacienteAction,
  obterArquivoPacienteReadUrlAction,
  prepararUploadArquivoPacienteAction,
  salvarPacienteAction,
} from "@/app/(protected)/pacientes/paciente.actions";

type TerapiaKey = "Convencional" | "Intensiva" | "Especial" | "Intercambio";
type Kind = "foto" | "laudo" | "documento";

type PacienteFormValues = z.input<typeof savePacienteSchema>;

const terapiaOptions: Array<{ key: TerapiaKey; label: string }> = [
  { key: "Convencional", label: "Convencional" },
  { key: "Intensiva", label: "Intensiva" },
  { key: "Especial", label: "Especial" },
  { key: "Intercambio", label: "Intercambio" },
];

const terapiaCanonicalByNormalized = new Map<string, TerapiaKey>(
  terapiaOptions.map((option) => [normalizeTextForMatch(option.key), option.key])
);

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

function normalizeTextForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeTerapias(values: Array<string | null | undefined> | null | undefined): TerapiaKey[] {
  const seen = new Set<TerapiaKey>();
  const normalized: TerapiaKey[] = [];
  for (const raw of values ?? []) {
    if (typeof raw !== "string") continue;
    const canonical = terapiaCanonicalByNormalized.get(normalizeTextForMatch(raw));
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    normalized.push(canonical);
  }
  return normalized;
}

function buildFormValues(initial?: PacienteFormInitial): PacienteFormValues {
  const ativo = initial?.ativo;
  return {
    nome: String(initial?.nome ?? ""),
    cpf: formatCpf(String(initial?.cpf ?? "")),
    sexo: String(initial?.sexo ?? ""),
    nascimento: ymd(initial?.nascimento ?? null),
    convenio: String(initial?.convenio ?? "Particular"),
    nomeMae: String(initial?.nomeMae ?? ""),
    nomePai: String(initial?.nomePai ?? ""),
    nomeResponsavel: String(initial?.nomeResponsavel ?? ""),
    telefone: formatTelefone(String(initial?.telefone ?? "")),
    telefone2: formatTelefone(String(initial?.telefone2 ?? "")),
    email: String(initial?.email ?? ""),
    dataInicio: ymd(initial?.dataInicio ?? null),
    ativo: ativo === 0 || ativo === "0" || ativo === false ? "0" : "1",
    terapias: normalizeTerapias(initial?.terapias),
    fotoAtual: initial?.foto ?? null,
    laudoAtual: initial?.laudo ?? null,
    documentoAtual: initial?.documento ?? null,
  };
}

function buildResetValues(currentFiles: Pick<PacienteFormValues, "fotoAtual" | "laudoAtual" | "documentoAtual">): PacienteFormValues {
  return {
    ...buildFormValues(),
    ...currentFiles,
  };
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao salvar paciente";
}

function uploadNetworkErrorMessage(kind: Kind): string {
  return `Falha ao enviar ${labelForKind(kind)}. Tente novamente em instantes.`;
}

function uploadRejectedMessage(kind: Kind): string {
  return `Falha ao enviar ${labelForKind(kind)}. O armazenamento recusou a requisicao.`;
}

function readFieldError(message: unknown): string | null {
  return typeof message === "string" && message.trim() ? message : null;
}

function unwrapAction<T>(
  result: { ok: true; data: T } | { ok: false; error: string }
): T {
  if (!result.ok) throw new Error(result.error || "Erro ao processar arquivo");
  return result.data;
}

async function openSignedUrl(pacienteId: number, kind: Kind) {
  const data = unwrapAction(await obterArquivoPacienteReadUrlAction(pacienteId, kind));
  const url = data.url;
  if (!url) throw new Error("Arquivo nao encontrado");
  window.open(url, "_blank", "noopener,noreferrer");
}

async function presignUpload(pacienteId: number, kind: Kind, file: File) {
  const data = unwrapAction(
    await prepararUploadArquivoPacienteAction(pacienteId, {
      kind,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    })
  );
  const key = data.key;
  const url = data.url;
  if (!key || !url) throw new Error("Resposta invalida ao preparar upload");
  return { key, url };
}

async function commitKey(pacienteId: number, kind: Kind, key: string | null) {
  unwrapAction(await commitArquivoPacienteAction(pacienteId, { kind, key }));
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

  const {
    control,
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PacienteFormValues>({
    resolver: zodResolver(savePacienteSchema),
    defaultValues: buildFormValues(props.initial),
  });

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [laudoFile, setLaudoFile] = useState<File | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fotoAtual = watch("fotoAtual");
  const laudoAtual = watch("laudoAtual");
  const documentoAtual = watch("documentoAtual");

  async function uploadIfSelected(pacienteId: number) {
    const items: Array<{ kind: Kind; file: File; setCurrent: (key: string | null) => void }> = [];
    if (fotoFile) items.push({ kind: "foto", file: fotoFile, setCurrent: (key) => setValue("fotoAtual", key) });
    if (laudoFile) items.push({ kind: "laudo", file: laudoFile, setCurrent: (key) => setValue("laudoAtual", key) });
    if (documentoFile) {
      items.push({
        kind: "documento",
        file: documentoFile,
        setCurrent: (key) => setValue("documentoAtual", key),
      });
    }

    for (const item of items) {
      const { key, url } = await presignUpload(pacienteId, item.kind, item.file);
      let put: Response;
      try {
        put = await fetch(url, {
          method: "PUT",
          headers: { "content-type": item.file.type || "application/octet-stream" },
          body: item.file,
        });
      } catch {
        throw new Error(uploadNetworkErrorMessage(item.kind));
      }
      if (!put.ok) {
        throw new Error(uploadRejectedMessage(item.kind));
      }
      await commitKey(pacienteId, item.kind, key);
      item.setCurrent(key);
    }

    setFotoFile(null);
    setLaudoFile(null);
    setDocumentoFile(null);
  }

  const submit = handleSubmit(
    async (values) => {
      setBusy(true);
      setMsg(null);
      try {
        const payload = {
          ...values,
          nome: typeof values.nome === "string" ? values.nome.trim() : "",
          cpf: digitsOnly(String(values.cpf ?? "")).slice(0, 11),
          nascimento: typeof values.nascimento === "string" ? values.nascimento : null,
          convenio: typeof values.convenio === "string" && values.convenio ? values.convenio : "Particular",
          email: typeof values.email === "string" ? values.email.trim() || null : null,
          nomeResponsavel:
            typeof values.nomeResponsavel === "string" ? values.nomeResponsavel.trim() : "",
          telefone: typeof values.telefone === "string" ? values.telefone.trim() : "",
          telefone2: typeof values.telefone2 === "string" ? values.telefone2.trim() || null : null,
          nomeMae: typeof values.nomeMae === "string" ? values.nomeMae.trim() || null : null,
          nomePai: typeof values.nomePai === "string" ? values.nomePai.trim() || null : null,
          sexo: typeof values.sexo === "string" ? values.sexo : "",
          dataInicio: typeof values.dataInicio === "string" ? values.dataInicio : null,
          ativo: values.ativo === "0" ? 0 : 1,
          terapias: normalizeTerapias(values.terapias),
          fotoAtual,
          laudoAtual,
          documentoAtual,
        };

        const isEdit = props.mode === "edit" && !!initialId;
        const result = await salvarPacienteAction(payload, isEdit ? initialId : null);
        if (!result.ok) throw new Error(result.error || "Erro ao salvar paciente");

        const id = result.data.id;
        if (!id) throw new Error("Resposta invalida: id ausente");

        const reaproveitado = !isEdit ? result.data.reaproveitado : null;
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
    },
    () => {
      setMsg("Confira os campos obrigatorios.");
    }
  );

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
    reset(
      buildResetValues({
        fotoAtual: getValues("fotoAtual") ?? null,
        laudoAtual: getValues("laudoAtual") ?? null,
        documentoAtual: getValues("documentoAtual") ?? null,
      })
    );
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

      <form className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome completo</span>
          <input
            {...register("nome")}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Nome e sobrenome"
          />
          {readFieldError(errors.nome?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.nome?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">CPF</span>
          <Controller
            name="cpf"
            control={control}
            render={({ field }) => (
              <input
                value={field.value ?? ""}
                onChange={(e) => field.onChange(formatCpf(e.target.value))}
                inputMode="numeric"
                maxLength={14}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                placeholder="000.000.000-00"
              />
            )}
          />
          {readFieldError(errors.cpf?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.cpf?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Sexo</span>
          <select
            {...register("sexo")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          >
            <option value="">Selecione</option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Outro">Outro</option>
          </select>
          {readFieldError(errors.sexo?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.sexo?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Data de nascimento</span>
          <input
            type="date"
            {...register("nascimento")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          />
          {readFieldError(errors.nascimento?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.nascimento?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Convenio do paciente</span>
          <select
            {...register("convenio")}
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
            {...register("nomeMae", {
              setValueAs: (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            })}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Responsavel materno"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome do pai</span>
          <input
            {...register("nomePai", {
              setValueAs: (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            })}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Responsavel paterno"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Nome do responsavel</span>
          <input
            {...register("nomeResponsavel")}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="Quem sera contatado"
          />
          {readFieldError(errors.nomeResponsavel?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.nomeResponsavel?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Telefone do responsavel</span>
          <Controller
            name="telefone"
            control={control}
            render={({ field }) => (
              <input
                value={field.value ?? ""}
                onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                maxLength={15}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                placeholder="(00) 00000-0000"
              />
            )}
          />
          {readFieldError(errors.telefone?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.telefone?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Telefone do responsavel (2)</span>
          <Controller
            name="telefone2"
            control={control}
            render={({ field }) => (
              <input
                value={typeof field.value === "string" ? field.value : ""}
                onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                maxLength={15}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                placeholder="(00) 00000-0000"
              />
            )}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Email do responsavel</span>
          <input
            type="email"
            {...register("email", {
              setValueAs: (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            })}
            className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            placeholder="contato@exemplo.com"
          />
          {readFieldError(errors.email?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.email?.message)}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--marrom)]">Data de inicio</span>
          <input
            type="date"
            {...register("dataInicio")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
          />
          {readFieldError(errors.dataInicio?.message) ? (
            <p className="text-xs text-red-600">{readFieldError(errors.dataInicio?.message)}</p>
          ) : null}
        </label>

        <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Status do paciente</span>
            <select
              {...register("ativo")}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            >
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </label>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-[var(--marrom)]">Tipo de terapia</p>
            <Controller
              name="terapias"
              control={control}
              render={({ field }) => {
                const selected = normalizeTerapias(field.value);
                return (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {terapiaOptions.map((t) => {
                      const checked = selected.includes(t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => field.onChange(toggleArrayValue(selected, t.key, !checked))}
                          className={`flex w-full items-center rounded-lg border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-[var(--laranja)] bg-[var(--laranja)]/10 text-[var(--marrom)]"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                          }`}
                        >
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            />
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
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            {busy ? "Salvando..." : submitLabel}
          </button>
        </div>
      </form>

      {msg ? <p className="mt-4 text-sm text-gray-700">{msg}</p> : null}
    </section>
  );
}
