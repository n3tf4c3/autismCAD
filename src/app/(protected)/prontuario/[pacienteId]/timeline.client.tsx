"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type TimelineItem =
  | {
      kind: "documento";
      id: number;
      tipo: string;
      titulo: string | null;
      status: string | null;
      version: number | null;
      data: string;
      profissional: string | null;
    }
  | {
      kind: "evolucao";
      id: number;
      tipo: string;
      titulo: string | null;
      status: string | null;
      version: number | null;
      data: string;
      profissional: string | null;
    };

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

export function TimelineClient(props: { pacienteId: number; initialItems: TimelineItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [localItems, setLocalItems] = useState<TimelineItem[]>(props.initialItems);

  const items = useMemo(() => {
    return localItems.filter((i) => {
      if (tipo && i.kind !== tipo) return false;
      const d = new Date(i.data);
      if (ini && d < new Date(ini)) return false;
      if (fim && d > new Date(fim)) return false;
      return true;
    });
  }, [fim, ini, localItems, tipo]);

  async function deleteEvolucao(id: number) {
    if (!confirm("Deseja excluir esta evolucao?")) return;
    const resp = await fetch(`/api/prontuario/evolucao/${id}`, { method: "DELETE" });
    const data = (await resp.json().catch(() => ({}))) as { error?: string };
    if (!resp.ok) {
      alert(data.error || "Erro ao excluir evolucao");
      return;
    }
    setLocalItems((current) => current.filter((i) => !(i.kind === "evolucao" && i.id === id)));
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--marrom)]">Timeline clinica</h2>
          <p className="mt-1 text-sm text-gray-600">
            {items.length ? `${items.length} registros` : "Nenhum registro encontrado."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="documento">Documentos clinicos</option>
            <option value="evolucao">Evolucoes</option>
          </select>
          <input
            type="date"
            value={ini}
            onChange={(e) => setIni(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-5 space-y-4 border-l border-amber-200 pl-6">
        {items.map((item) => {
          const isDoc = item.kind === "documento";
          const isComportamento = !isDoc && item.tipo === "COMPORTAMENTO";
          const tipoLabel = isDoc
            ? "Documento clinico"
            : isComportamento
              ? "Registro de comportamento"
              : "Evolucao terapeutica";
          return (
            <div key={`${item.kind}-${item.id}`} className="relative pl-6">
              <span
                className={[
                  "absolute -left-[11px] top-2 h-4 w-4 rounded-full border-4 border-white shadow",
                  isDoc ? "bg-[var(--laranja)]" : "bg-[var(--verde)]",
                ].join(" ")}
              />
              <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-gray-600">
                    <span>{tipoLabel}</span>
                    <span className="rounded bg-amber-50 px-2 py-1 text-xs text-[var(--marrom)]">
                      {item.tipo}
                    </span>
                    {item.status ? (
                      <span className="rounded bg-amber-100 px-2 py-1 text-xs text-[var(--marrom)]">
                        {item.status}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-gray-500">{fmtDate(item.data)}</span>
                </div>

                <h3 className="font-semibold text-[var(--marrom)]">{item.titulo || "Registro"}</h3>
                <p className="text-sm text-gray-600">
                  Profissional: {item.profissional || "-"}
                </p>

                <div className="mt-3 flex flex-wrap gap-3">
                  {isDoc ? (
                    <>
                      <Link
                        className="text-sm font-semibold text-[var(--laranja)]"
                        href={`/prontuario/documento/${item.id}`}
                      >
                        Visualizar
                      </Link>
                      <Link
                        className="text-sm font-semibold text-[var(--laranja)]"
                        href={`/prontuario/${props.pacienteId}/novo-documento?tipo=${encodeURIComponent(
                          item.tipo
                        )}`}
                      >
                        Criar nova versao
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        className="text-sm font-semibold text-[var(--laranja)]"
                        href={`/prontuario/${props.pacienteId}/evolucao/${item.id}`}
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteEvolucao(item.id)}
                        className="text-sm font-semibold text-red-600"
                        disabled={isPending}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

