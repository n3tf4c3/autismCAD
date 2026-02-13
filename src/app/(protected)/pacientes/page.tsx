"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Paciente = {
  id: number;
  nome: string;
  cpf: string;
  convenio: string;
  email: string | null;
  telefone: string | null;
  terapias: string[];
};

function formatCpf(cpf: string): string {
  const digits = (cpf || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao carregar pacientes";
}

export default function PacientesPage() {
  const [items, setItems] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (nome.trim()) params.set("nome", nome.trim());
    if (cpf.trim()) params.set("cpf", cpf.trim());
    return params.toString();
  }, [nome, cpf]);

  async function loadPacientes() {
    setLoading(true);
    setError(null);
    try {
      const url = queryString ? `/api/pacientes?${queryString}` : "/api/pacientes";
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao carregar pacientes");
      }
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(normalizeApiError(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPacientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Pacientes</h1>
          <p className="text-sm text-gray-600">Primeira tela migrada para Next.js</p>
        </div>
        <button
          type="button"
          onClick={() => void loadPacientes()}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Recarregar
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[var(--marrom)]">Nome</span>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Buscar por nome"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[var(--marrom)]">CPF</span>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            value={cpf}
            onChange={(event) => setCpf(event.target.value)}
            placeholder="Buscar por CPF"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void loadPacientes()}
            className="w-full rounded-lg bg-[var(--laranja)] px-3 py-2 font-semibold text-white hover:bg-[#e6961f]"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              setNome("");
              setCpf("");
              void loadPacientes();
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Carregando...</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">CPF</th>
              <th className="px-3 py-2">Convenio</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Terapias</th>
              <th className="px-3 py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 text-sm">
                <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{item.nome}</td>
                <td className="px-3 py-3 text-gray-700">{formatCpf(item.cpf)}</td>
                <td className="px-3 py-3 text-gray-700">{item.convenio || "Particular"}</td>
                <td className="px-3 py-3 text-gray-700">
                  {item.email || item.telefone || "-"}
                </td>
                <td className="px-3 py-3 text-gray-700">
                  {item.terapias?.length ? item.terapias.join(", ") : "-"}
                </td>
                <td className="px-3 py-3 text-gray-700">
                  <div className="flex flex-wrap gap-3">
                    <Link className="text-sm font-semibold text-[var(--laranja)]" href={`/pacientes/${item.id}`}>
                      Ver
                    </Link>
                    <Link className="text-sm font-semibold text-[var(--laranja)]" href={`/prontuario/${item.id}`}>
                      Prontuario
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                  Nenhum paciente encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
