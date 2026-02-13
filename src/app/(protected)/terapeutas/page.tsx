"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Terapeuta = {
  id: number;
  nome: string;
  cpf: string;
  especialidade: string;
  email: string | null;
  telefone: string | null;
};

function formatCpf(cpf: string): string {
  const digits = (cpf || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao carregar terapeutas";
}

export default function TerapeutasPage() {
  const [items, setItems] = useState<Terapeuta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [especialidade, setEspecialidade] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (nome.trim()) params.set("nome", nome.trim());
    if (cpf.trim()) params.set("cpf", cpf.trim());
    if (especialidade.trim()) params.set("especialidade", especialidade.trim());
    return params.toString();
  }, [nome, cpf, especialidade]);

  async function loadTerapeutas() {
    setLoading(true);
    setError(null);
    try {
      const url = queryString ? `/api/terapeutas?${queryString}` : "/api/terapeutas";
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao carregar terapeutas");
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
    void loadTerapeutas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Terapeutas</h1>
          <p className="text-sm text-gray-600">Consultar e gerenciar terapeutas cadastrados.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/terapeutas/novo"
            className="rounded-lg bg-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f]"
          >
            + Novo cadastro
          </Link>
          <button
            type="button"
            onClick={() => void loadTerapeutas()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Recarregar
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
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
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[var(--marrom)]">Especialidade</span>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            value={especialidade}
            onChange={(event) => setEspecialidade(event.target.value)}
            placeholder="Buscar por especialidade"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void loadTerapeutas()}
            className="w-full rounded-lg bg-[var(--laranja)] px-3 py-2 font-semibold text-white hover:bg-[#e6961f]"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              setNome("");
              setCpf("");
              setEspecialidade("");
              void loadTerapeutas();
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
              <th className="px-3 py-2">Especialidade</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 text-sm">
                <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{item.nome}</td>
                <td className="px-3 py-3 text-gray-700">{formatCpf(item.cpf)}</td>
                <td className="px-3 py-3 text-gray-700">{item.especialidade || "-"}</td>
                <td className="px-3 py-3 text-gray-700">
                  {item.email || item.telefone || "-"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/terapeutas/${item.id}/editar`}
                      className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/calendario?terapeutaId=${item.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Agenda
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                  Nenhum terapeuta encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
