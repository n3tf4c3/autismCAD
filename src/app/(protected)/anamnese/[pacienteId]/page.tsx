"use client";

import { useEffect, useMemo, useState } from "react";

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

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro na requisicao";
}

export default function AnamnesePacientePage({
  params,
}: {
  params: { pacienteId: string };
}) {
  const pacienteId = Number(params.pacienteId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);

  const [entrevistaPor, setEntrevistaPor] = useState("");
  const [dataEntrevista, setDataEntrevista] = useState("");
  const [possuiDiagnostico, setPossuiDiagnostico] = useState<string>("");
  const [diagnostico, setDiagnostico] = useState("");
  const [status, setStatus] = useState<string>("Rascunho");

  const header = useMemo(() => {
    const ver = anamnese?.version ? `Versao ${anamnese.version}` : "Sem versao";
    const st = anamnese?.status ? `(${anamnese.status})` : "";
    return `${ver} ${st}`.trim();
  }, [anamnese]);

  function fillFormFrom(data: Anamnese | null) {
    setEntrevistaPor(String(data?.entrevistaPor ?? ""));
    setDataEntrevista(String(data?.dataEntrevista ?? ""));
    const pd = data?.possuiDiagnostico;
    setPossuiDiagnostico(pd === true ? "true" : pd === false ? "false" : "");
    setDiagnostico(String(data?.diagnostico ?? ""));
    setStatus(String(data?.status ?? "Rascunho"));
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [aResp, vResp] = await Promise.all([
        fetch(`/api/anamnese/${pacienteId}`, { cache: "no-store" }),
        fetch(`/api/anamnese/${pacienteId}/versions`, { cache: "no-store" }),
      ]);
      const [aJson, vJson] = await Promise.all([aResp.json(), vResp.json()]);
      if (!aResp.ok && aResp.status !== 404) {
        throw new Error(aJson?.error || "Erro ao carregar anamnese");
      }
      if (!vResp.ok) {
        throw new Error(vJson?.error || "Erro ao carregar versoes");
      }

      const a = aResp.status === 404 ? null : (aJson as Anamnese);
      setAnamnese(a);
      setVersions(Array.isArray(vJson) ? vJson : []);
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
        entrevistaPor: entrevistaPor || null,
        dataEntrevista: dataEntrevista || null,
        possuiDiagnostico:
          possuiDiagnostico === "true"
            ? true
            : possuiDiagnostico === "false"
              ? false
              : null,
        diagnostico: diagnostico || null,
        status,
      };
      const resp = await fetch(`/api/anamnese/${pacienteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Erro ao salvar");
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
  }, []);

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
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">
              Entrevista por
            </span>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={entrevistaPor}
              onChange={(e) => setEntrevistaPor(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">
              Data entrevista
            </span>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={dataEntrevista}
              onChange={(e) => setDataEntrevista(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">
              Possui diagnostico?
            </span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={possuiDiagnostico}
              onChange={(e) => setPossuiDiagnostico(e.target.value)}
            >
              <option value="">Nao informado</option>
              <option value="true">Sim</option>
              <option value="false">Nao</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">
              Diagnostico
            </span>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">
              Status
            </span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Rascunho">Rascunho</option>
              <option value="Finalizada">Finalizada</option>
            </select>
          </label>
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
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">
                    {v.version}
                  </td>
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
                          const resp = await fetch(
                            `/api/anamnese/${pacienteId}?version=${v.version}`,
                            { cache: "no-store" }
                          );
                          const json = await resp.json();
                          if (!resp.ok) throw new Error(json?.error || "Erro ao carregar versao");
                          const data = json as Anamnese;
                          setAnamnese(data);
                          fillFormFrom(data);
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
