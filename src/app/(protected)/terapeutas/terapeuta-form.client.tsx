"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TerapeutaFormInitial = {
  id?: number | null;
  nome?: string | null;
  cpf?: string | null;
  nascimento?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  email?: string | null;
  especialidade?: string | null;
};

type ApiError = { error?: string };
type ViaCepResp = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
};

const ESPECIALIDADES = [
  "Psicologia",
  "Terapia Ocupacional",
  "Fonoaudiologia",
  "Fisioterapia",
  "Psicopedagogia",
  "Outro",
] as const;

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

function formatCep(value: string): string {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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
  return "Erro ao salvar terapeuta";
}

async function readJson(resp: Response): Promise<unknown> {
  return resp.json().catch(() => null);
}

function readError(data: unknown): string | null {
  const rec = data as ApiError | null;
  return rec && typeof rec.error === "string" ? rec.error : null;
}

function joinEndereco(parts: {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
}): string {
  const out = [parts.logradouro, parts.numero, parts.bairro, parts.cidade].map((s) => s.trim()).filter(Boolean);
  return out.join(", ");
}

export function TerapeutaFormClient(props: { mode: "create" | "edit"; initial?: TerapeutaFormInitial }) {
  const router = useRouter();

  const initialId = props.initial?.id ?? null;

  const [nome, setNome] = useState(String(props.initial?.nome ?? ""));
  const [cpf, setCpf] = useState(formatCpf(String(props.initial?.cpf ?? "")));
  const [nascimento, setNascimento] = useState(ymd(props.initial?.nascimento ?? null));
  const [telefone, setTelefone] = useState(formatTelefone(String(props.initial?.telefone ?? "")));
  const [cep, setCep] = useState(formatCep(String(props.initial?.cep ?? "")));
  const [logradouro, setLogradouro] = useState(String(props.initial?.logradouro ?? ""));
  const [numero, setNumero] = useState(String(props.initial?.numero ?? ""));
  const [bairro, setBairro] = useState(String(props.initial?.bairro ?? ""));
  const [cidade, setCidade] = useState(String(props.initial?.cidade ?? ""));
  const [email, setEmail] = useState(String(props.initial?.email ?? ""));
  const [especialidade, setEspecialidade] = useState(String(props.initial?.especialidade ?? ""));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [cepHint, setCepHint] = useState<string | null>(null);
  const lastAutoRef = useRef<{ cepDigits: string; logradouro: string; bairro: string; cidade: string } | null>(null);

  const enderecoResumo = useMemo(
    () =>
      joinEndereco({
        logradouro,
        numero,
        bairro,
        cidade,
      }) || "-",
    [logradouro, numero, bairro, cidade]
  );

  useEffect(() => {
    const cepDigits = digitsOnly(cep).slice(0, 8);
    if (cepDigits.length !== 8) {
      setCepStatus("idle");
      setCepHint(null);
      return;
    }
    if (lastAutoRef.current?.cepDigits === cepDigits) return;

    const ac = new AbortController();
    setCepStatus("loading");
    setCepHint("Buscando CEP...");

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal: ac.signal });
          const data = (await resp.json().catch(() => null)) as ViaCepResp | null;
          if (!resp.ok) throw new Error("Falha ao consultar CEP");
          if (!data || data.erro) {
            setCepStatus("error");
            setCepHint("CEP nao encontrado.");
            return;
          }

          const prev = lastAutoRef.current;
          const viacepLogradouro = String(data.logradouro ?? "").trim();
          const viacepBairro = String(data.bairro ?? "").trim();
          const viacepCidade = String(data.localidade ?? "").trim();

          const currLogradouro = (logradouro ?? "").trim();
          const currBairro = (bairro ?? "").trim();
          const currCidade = (cidade ?? "").trim();

          const canReplaceLogradouro = !currLogradouro || (prev && currLogradouro === prev.logradouro.trim());
          const canReplaceBairro = !currBairro || (prev && currBairro === prev.bairro.trim());
          const canReplaceCidade = !currCidade || (prev && currCidade === prev.cidade.trim());

          const nextLogradouro = canReplaceLogradouro ? (viacepLogradouro || currLogradouro) : currLogradouro;
          const nextBairro = canReplaceBairro ? (viacepBairro || currBairro) : currBairro;
          const nextCidade = canReplaceCidade ? (viacepCidade || currCidade) : currCidade;

          if (canReplaceLogradouro && viacepLogradouro) setLogradouro(viacepLogradouro);
          if (canReplaceBairro && viacepBairro) setBairro(viacepBairro);
          if (canReplaceCidade && viacepCidade) setCidade(viacepCidade);

          lastAutoRef.current = {
            cepDigits,
            logradouro: nextLogradouro,
            bairro: nextBairro,
            cidade: nextCidade,
          };
          setCepStatus("ok");
          setCepHint("Endereco preenchido pelo CEP.");
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return;
          setCepStatus("error");
          setCepHint("Nao foi possivel consultar o CEP.");
        }
      })();
    }, 350);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [bairro, cep, cidade, logradouro]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        nome: nome.trim(),
        cpf: digitsOnly(cpf).slice(0, 11),
        nascimento: nascimento || null,
        telefone: digitsOnly(telefone) ? telefone : null,
        cep: digitsOnly(cep) ? cep : null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        email: email.trim() || null,
        especialidade: especialidade.trim(),
        endereco: null,
      };

      const isEdit = props.mode === "edit";
      const url = isEdit ? `/api/terapeutas/${initialId}` : "/api/terapeutas";
      const method = isEdit ? "PUT" : "POST";

      const resp = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(resp);
      if (!resp.ok) throw new Error(readError(data) || "Erro ao salvar terapeuta");

      router.push("/terapeutas");
      router.refresh();
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 md:p-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-xl bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🧑‍⚕️</div>
            <div>
              <h3 className="text-lg font-bold text-[var(--marrom)]">Dados do terapeuta</h3>
              <p className="text-sm text-gray-600">Preencha as informacoes do profissional.</p>
            </div>
          </div>

          <form
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            autoComplete="off"
          >
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="nome">
                Nome completo
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                placeholder="Nome e sobrenome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="cpf">
                CPF
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                inputMode="numeric"
                required
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="nascimento">
                Data de nascimento
              </label>
              <input
                id="nascimento"
                name="nascimento"
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="telefone">
                Telefone
              </label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="cep">
                  CEP
                </label>
                <input
                  id="cep"
                  name="cep"
                  type="text"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(formatCep(e.target.value))}
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                />
                {cepHint ? (
                  <p
                    className={[
                      "text-xs",
                      cepStatus === "error" ? "text-red-600" : cepStatus === "ok" ? "text-emerald-700" : "text-gray-500",
                    ].join(" ")}
                  >
                    {cepHint}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="logradouro">
                  Logradouro
                </label>
                <input
                  id="logradouro"
                  name="logradouro"
                  type="text"
                  placeholder="Rua / Av."
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="numero">
                  Numero
                </label>
                <input
                  id="numero"
                  name="numero"
                  type="text"
                  placeholder="nº"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="bairro">
                  Bairro
                </label>
                <input
                  id="bairro"
                  name="bairro"
                  type="text"
                  placeholder="Bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="cidade">
                  Cidade
                </label>
                <input
                  id="cidade"
                  name="cidade"
                  type="text"
                  placeholder="Cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="profissional@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="especialidade">
                Especialidade
              </label>
              <select
                id="especialidade"
                name="especialidade"
                required
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              >
                <option value="">Selecione</option>
                {ESPECIALIDADES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-4">
              {msg ? <p className="text-sm text-red-600">{msg}</p> : <span />}
              <div className="flex items-center gap-3">
                <button
                  type="reset"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setNome("");
                    setCpf("");
                    setNascimento("");
                    setTelefone("");
                    setCep("");
                    setLogradouro("");
                    setNumero("");
                    setBairro("");
                    setCidade("");
                    setEmail("");
                   setEspecialidade("");
                    setMsg(null);
                    setCepStatus("idle");
                    setCepHint(null);
                    lastAutoRef.current = null;
                  }}
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar terapeuta"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--laranja)] text-xl text-white">
              📚
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Resumo</p>
              <h4 className="text-lg font-semibold text-[var(--marrom)]">Ficha do terapeuta</h4>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex flex-col border-b border-gray-100 pb-3">
              <span className="text-gray-500">Nome</span>
              <strong className="text-[var(--texto)]">{nome.trim() || "-"}</strong>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col border-b border-gray-100 pb-3">
                <span className="text-gray-500">CPF</span>
                <strong className="text-[var(--texto)]">{cpf || "-"}</strong>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-3">
                <span className="text-gray-500">Nascimento</span>
                <strong className="text-[var(--texto)]">{nascimento || "-"}</strong>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col border-b border-gray-100 pb-3">
                <span className="text-gray-500">Telefone</span>
                <strong className="text-[var(--texto)]">{telefone || "-"}</strong>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-3 sm:col-span-2">
                <span className="text-gray-500">Endereco</span>
                <strong className="text-[var(--texto)]">{enderecoResumo}</strong>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-3">
                <span className="text-gray-500">CEP</span>
                <strong className="text-[var(--texto)]">{cep || "-"}</strong>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-3">
                <span className="text-gray-500">Especialidade</span>
                <strong className="text-[var(--texto)]">{especialidade || "-"}</strong>
              </div>
            </div>
            <div className="flex flex-col border-b border-gray-100 pb-3">
              <span className="text-gray-500">Email</span>
              <strong className="text-[var(--texto)]">{email.trim() || "-"}</strong>
            </div>
            <div className="rounded-lg border border-[#f1e1c7] bg-[#fff6e6] p-3 text-xs leading-relaxed text-[var(--marrom)]">
              Os dados sao salvos na base de terapeutas e podem ser consultados ou editados pela equipe.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
