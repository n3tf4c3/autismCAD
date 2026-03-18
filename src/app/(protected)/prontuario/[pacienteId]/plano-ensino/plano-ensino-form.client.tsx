"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ESPECIALIDADES_TERAPEUTA } from "@/lib/terapeutas/especialidades";
import { salvarDocumentoProntuarioAction } from "@/app/(protected)/prontuario/prontuario.actions";

type BlocoForm = {
  id: string;
  habilidade: string;
  ensino: string;
  objetivoEnsino: string;
  recursos: string;
  procedimento: string;
  suportes: string;
  objetivoEspecifico: string;
  criterioSucesso: string;
};

type BlocoInput = {
  [K in keyof Omit<BlocoForm, "id">]: string | null;
};

export type PlanoEnsinoInitialData = {
  especialidade: string | null;
  dataInicio: string | null;
  dataFinal: string | null;
  blocos: BlocoInput[];
  sourceDocumentId?: number | null;
  sourceVersion?: number | null;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createBloco(values?: Partial<BlocoInput>): BlocoForm {
  return {
    id: uid(),
    habilidade: values?.habilidade ?? "",
    ensino: values?.ensino ?? "",
    objetivoEnsino: values?.objetivoEnsino ?? "",
    recursos: values?.recursos ?? "",
    procedimento: values?.procedimento ?? "",
    suportes: values?.suportes ?? "",
    objetivoEspecifico: values?.objetivoEspecifico ?? "",
    criterioSucesso: values?.criterioSucesso ?? "",
  };
}

function Input(props: {
  label: string;
  value: string;
  type?: "text" | "date";
  className?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`text-sm ${props.className ?? ""}`.trim()}>
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
      />
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  className?: string;
  placeholder?: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={`text-sm ${props.className ?? ""}`.trim()}>
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
      >
        <option value="">{props.placeholder ?? "Selecione"}</option>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea(props: {
  label: string;
  value: string;
  className?: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`text-sm ${props.className ?? ""}`.trim()}>
      <span className="mb-1 block font-semibold text-[var(--marrom)]">{props.label}</span>
      <textarea
        value={props.value}
        rows={props.rows ?? 3}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
      />
    </label>
  );
}

function getInitialBlocos(initialData?: PlanoEnsinoInitialData | null): BlocoForm[] {
  if (!initialData?.blocos?.length) return [createBloco()];
  return initialData.blocos.map((bloco) => createBloco({
    habilidade: bloco.habilidade ?? "",
    ensino: bloco.ensino ?? "",
    objetivoEnsino: bloco.objetivoEnsino ?? "",
    recursos: bloco.recursos ?? "",
    procedimento: bloco.procedimento ?? "",
    suportes: bloco.suportes ?? "",
    objetivoEspecifico: bloco.objetivoEspecifico ?? "",
    criterioSucesso: bloco.criterioSucesso ?? "",
  }));
}

function unwrapAction<T>(
  result: { ok: true; data: T } | { ok: false; error: string }
): T {
  if (!result.ok) throw new Error(result.error || "Erro ao salvar plano de ensino");
  return result.data;
}

export function PlanoEnsinoFormClient(props: { pacienteId: number; initialData?: PlanoEnsinoInitialData | null }) {
  const router = useRouter();
  const [especialidade, setEspecialidade] = useState(() => props.initialData?.especialidade ?? "");
  const [dataInicio, setDataInicio] = useState(() => props.initialData?.dataInicio ?? "");
  const [dataFinal, setDataFinal] = useState(() => props.initialData?.dataFinal ?? "");
  const [blocos, setBlocos] = useState<BlocoForm[]>(() => getInitialBlocos(props.initialData));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEditing = !!props.initialData?.sourceDocumentId;

  function addBloco() {
    setBlocos((current) => [...current, createBloco()]);
  }

  function updateBloco(id: string, key: keyof Omit<BlocoForm, "id">, value: string) {
    setBlocos((current) => current.map((bloco) => (bloco.id === id ? { ...bloco, [key]: value } : bloco)));
  }

  function removeBloco(id: string) {
    setBlocos((current) => (current.length > 1 ? current.filter((bloco) => bloco.id !== id) : current));
  }

  async function submit(status: "Rascunho" | "Finalizado") {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        tipo: "PLANO_ENSINO",
        status,
        titulo: null,
        payload: {
          especialidade: especialidade.trim() || null,
          dataInicio: dataInicio || null,
          dataFinal: dataFinal || null,
          blocos: blocos.map((bloco) => ({
            habilidade: bloco.habilidade,
            ensino: bloco.ensino,
            objetivoEnsino: bloco.objetivoEnsino,
            recursos: bloco.recursos,
            procedimento: bloco.procedimento,
            suportes: bloco.suportes,
            objetivoEspecifico: bloco.objetivoEspecifico,
            criterioSucesso: bloco.criterioSucesso,
          })),
        },
      };

      const data = unwrapAction(await salvarDocumentoProntuarioAction(props.pacienteId, payload));
      setMsg(`Plano de ensino salvo. Versao ${data.version ?? "-"}.`);
      if (data.id) {
        setTimeout(() => router.push(`/prontuario/documento/${data.id}`), 650);
      } else {
        setTimeout(() => router.push(`/prontuario/${props.pacienteId}`), 650);
      }
    } catch (error) {
      const err = error as { message?: string };
      setMsg(err.message || "Falha ao salvar plano de ensino");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--marrom)]">Plano de Ensino</h1>
      <p className="mt-1 text-sm text-gray-600">Cada salvamento cria uma nova versao do documento.</p>

      <div className="mt-5 space-y-5">
        {isEditing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[var(--marrom)]">
            <p className="font-semibold">
              Editando a partir da versao {props.initialData?.sourceVersion ?? "-"}.
            </p>
            <p className="mt-1">
              Ao salvar, o sistema cria uma nova versao do plano.
            </p>
            {props.initialData?.sourceDocumentId ? (
              <Link
                href={`/prontuario/documento/${props.initialData.sourceDocumentId}`}
                className="mt-2 inline-flex font-semibold text-[var(--laranja)]"
              >
                Visualizar versao atual
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            label="Especialidade"
            value={especialidade}
            options={ESPECIALIDADES_TERAPEUTA}
            onChange={setEspecialidade}
          />
          <Input label="Data de inicio" type="date" value={dataInicio} onChange={setDataInicio} />
          <Input label="Data final" type="date" value={dataFinal} onChange={setDataFinal} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-[#fffaf2] p-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={addBloco}
              className="rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
            >
              +Adicionar
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {blocos.map((bloco) => (
              <section key={bloco.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {blocos.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeBloco(bloco.id)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Remover bloco
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="Habilidade"
                      value={bloco.habilidade}
                      onChange={(value) => updateBloco(bloco.id, "habilidade", value)}
                    />
                    <Input label="Ensino" value={bloco.ensino} onChange={(value) => updateBloco(bloco.id, "ensino", value)} />
                  </div>

                  <Textarea
                    label="Objetivo de Ensino"
                    value={bloco.objetivoEnsino}
                    onChange={(value) => updateBloco(bloco.id, "objetivoEnsino", value)}
                  />
                  <Textarea
                    label="Procedimento"
                    value={bloco.procedimento}
                    onChange={(value) => updateBloco(bloco.id, "procedimento", value)}
                  />
                  <Textarea label="Recursos" value={bloco.recursos} onChange={(value) => updateBloco(bloco.id, "recursos", value)} />
                  <Textarea label="Suportes" value={bloco.suportes} onChange={(value) => updateBloco(bloco.id, "suportes", value)} />
                  <Textarea
                    label="Objetivo Especifico"
                    value={bloco.objetivoEspecifico}
                    onChange={(value) => updateBloco(bloco.id, "objetivoEspecifico", value)}
                  />
                  <Textarea
                    label="Criterio de Sucesso"
                    value={bloco.criterioSucesso}
                    onChange={(value) => updateBloco(bloco.id, "criterioSucesso", value)}
                  />
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("Rascunho")}
            className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:opacity-60"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("Finalizado")}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            Finalizar
          </button>
        </div>

        {msg ? <p className="text-sm text-gray-700">{msg}</p> : null}
      </div>
    </section>
  );
}
