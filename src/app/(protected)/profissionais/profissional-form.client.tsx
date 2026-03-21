"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { ESPECIALIDADES_PROFISSIONAL } from "@/lib/profissionais/especialidades";
import { saveProfissionalSchema } from "@/server/modules/profissionais/profissionais.schema";
import { salvarProfissionalAction } from "@/app/(protected)/profissionais/profissional.actions";

type ProfissionalFormInitial = {
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
  observacao?: string | null;
};

type ViaCepResp = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
};

type ProfissionalFormValues = z.input<typeof saveProfissionalSchema>;

const EMPTY_FORM_VALUES: ProfissionalFormValues = {
  nome: "",
  cpf: "",
  nascimento: "",
  email: "",
  telefone: "",
  endereco: null,
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  cep: "",
  especialidade: "",
  observacao: "",
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

function formatCep(value: string): string {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function ymd(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function joinEndereco(parts: {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
}): string {
  const out = [parts.logradouro, parts.numero, parts.bairro, parts.cidade]
    .map((value) => value.trim())
    .filter(Boolean);
  return out.join(", ");
}

function buildFormValues(initial?: ProfissionalFormInitial): ProfissionalFormValues {
  return {
    nome: String(initial?.nome ?? ""),
    cpf: formatCpf(String(initial?.cpf ?? "")),
    nascimento: ymd(initial?.nascimento ?? null),
    email: String(initial?.email ?? ""),
    telefone: formatTelefone(String(initial?.telefone ?? "")),
    endereco: null,
    logradouro: String(initial?.logradouro ?? ""),
    numero: String(initial?.numero ?? ""),
    bairro: String(initial?.bairro ?? ""),
    cidade: String(initial?.cidade ?? ""),
    cep: formatCep(String(initial?.cep ?? "")),
    especialidade: String(initial?.especialidade ?? ""),
    observacao: String(initial?.observacao ?? ""),
  };
}

export function ProfissionalFormClient(props: { mode: "create" | "edit"; initial?: ProfissionalFormInitial }) {
  const router = useRouter();
  const initialId = props.initial?.id ?? null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [cepHint, setCepHint] = useState<string | null>(null);
  const lastAutoRef = useRef<{ cepDigits: string; logradouro: string; bairro: string; cidade: string } | null>(
    null
  );

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<ProfissionalFormValues>({
    resolver: zodResolver(saveProfissionalSchema),
    defaultValues: buildFormValues(props.initial),
  });

  const nome = watch("nome") ?? "";
  const cpf = watch("cpf") ?? "";
  const nascimento = watch("nascimento") ?? "";
  const telefone = watch("telefone") ?? "";
  const cep = watch("cep") ?? "";
  const logradouro = watch("logradouro") ?? "";
  const numero = watch("numero") ?? "";
  const bairro = watch("bairro") ?? "";
  const cidade = watch("cidade") ?? "";
  const email = watch("email") ?? "";
  const especialidade = watch("especialidade") ?? "";
  const observacao = watch("observacao") ?? "";

  const enderecoResumo = useMemo(
    () =>
      joinEndereco({
        logradouro,
        numero,
        bairro,
        cidade,
      }) || "-",
    [bairro, cidade, logradouro, numero]
  );

  useEffect(() => {
    const cepDigits = digitsOnly(cep).slice(0, 8);
    if (cepDigits.length !== 8) {
      setCepStatus("idle");
      setCepHint(null);
      return;
    }
    if (lastAutoRef.current?.cepDigits === cepDigits) return;

    const controller = new AbortController();
    setCepStatus("loading");
    setCepHint("Buscando CEP...");

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
            signal: controller.signal,
          });
          const data = (await resp.json().catch(() => null)) as ViaCepResp | null;
          if (!resp.ok) throw new Error("Falha ao consultar CEP");
          if (!data || data.erro) {
            setCepStatus("error");
            setCepHint("CEP não encontrado.");
            return;
          }

          const prev = lastAutoRef.current;
          const viacepLogradouro = String(data.logradouro ?? "").trim();
          const viacepBairro = String(data.bairro ?? "").trim();
          const viacepCidade = String(data.localidade ?? "").trim();

          const currLogradouro = String(logradouro ?? "").trim();
          const currBairro = String(bairro ?? "").trim();
          const currCidade = String(cidade ?? "").trim();

          const canReplaceLogradouro = !currLogradouro || Boolean(prev && currLogradouro === prev.logradouro.trim());
          const canReplaceBairro = !currBairro || Boolean(prev && currBairro === prev.bairro.trim());
          const canReplaceCidade = !currCidade || Boolean(prev && currCidade === prev.cidade.trim());

          const nextLogradouro = canReplaceLogradouro ? viacepLogradouro || currLogradouro : currLogradouro;
          const nextBairro = canReplaceBairro ? viacepBairro || currBairro : currBairro;
          const nextCidade = canReplaceCidade ? viacepCidade || currCidade : currCidade;

          if (canReplaceLogradouro && viacepLogradouro) {
            setValue("logradouro", viacepLogradouro, { shouldDirty: true, shouldValidate: true });
          }
          if (canReplaceBairro && viacepBairro) {
            setValue("bairro", viacepBairro, { shouldDirty: true, shouldValidate: true });
          }
          if (canReplaceCidade && viacepCidade) {
            setValue("cidade", viacepCidade, { shouldDirty: true, shouldValidate: true });
          }

          lastAutoRef.current = {
            cepDigits,
            logradouro: nextLogradouro,
            bairro: nextBairro,
            cidade: nextCidade,
          };
          setCepStatus("ok");
          setCepHint("Endereço preenchido pelo CEP.");
        } catch (error) {
          if ((error as { name?: string }).name === "AbortError") return;
          setCepStatus("error");
          setCepHint("Não foi possível consultar o CEP.");
        }
      })();
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bairro, cep, cidade, logradouro, setValue]);

  function clearForm() {
    reset(EMPTY_FORM_VALUES);
    setMsg(null);
    setCepStatus("idle");
    setCepHint(null);
    lastAutoRef.current = null;
  }

  const submit = handleSubmit(
    async (values) => {
      setBusy(true);
      setMsg(null);
      try {
        const payload = {
          nome: values.nome.trim(),
          cpf: digitsOnly(values.cpf).slice(0, 11),
          nascimento: values.nascimento || null,
          telefone: digitsOnly(String(values.telefone ?? "")) ? String(values.telefone).trim() : null,
          cep: digitsOnly(String(values.cep ?? "")).slice(0, 8) || null,
          logradouro: String(values.logradouro ?? "").trim() || null,
          numero: String(values.numero ?? "").trim() || null,
          bairro: String(values.bairro ?? "").trim() || null,
          cidade: String(values.cidade ?? "").trim() || null,
          email: String(values.email ?? "").trim() || null,
          especialidade: values.especialidade.trim(),
          observacao: String(values.observacao ?? "").trim() || null,
          endereco: null,
        };

        const isEdit = props.mode === "edit";
        const result = await salvarProfissionalAction(payload, isEdit ? initialId : null);
        if (!result.ok) {
          setMsg(result.error || "Erro ao salvar profissional");
          return;
        }

        router.push("/profissionais");
        router.refresh();
      } catch (error) {
        if (error instanceof Error) setMsg(error.message);
        else setMsg("Erro ao salvar profissional");
      } finally {
        setBusy(false);
      }
    },
    () => setMsg("Confira os campos obrigatórios.")
  );

  return (
    <main className="p-4 md:p-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-xl bg-white p-6 shadow-sm xl:col-span-2">
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Dados do profissional</h3>
            <p className="text-sm text-gray-600">Preencha as informações do profissional.</p>
          </div>

          <form className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit} autoComplete="off">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="nome">
                Nome completo
              </label>
              <input
                id="nome"
                type="text"
                placeholder="Nome e sobrenome"
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                {...register("nome")}
              />
              {errors.nome ? <p className="text-xs text-red-600">{errors.nome.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="cpf">
                CPF
              </label>
              <Controller
                name="cpf"
                control={control}
                render={({ field }) => (
                  <input
                    id="cpf"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(formatCpf(event.target.value))}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  />
                )}
              />
              {errors.cpf ? <p className="text-xs text-red-600">{errors.cpf.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="nascimento">
                Data de nascimento
              </label>
              <input
                id="nascimento"
                type="date"
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                {...register("nascimento")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="telefone">
                Telefone
              </label>
              <Controller
                name="telefone"
                control={control}
                render={({ field }) => (
                  <input
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(formatTelefone(event.target.value))}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  />
                )}
              />
              {errors.telefone ? <p className="text-xs text-red-600">{errors.telefone.message}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="cep">
                  CEP
                </label>
                <Controller
                  name="cep"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="cep"
                      type="text"
                      placeholder="00000-000"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(formatCep(event.target.value))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                    />
                  )}
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
                {errors.cep ? <p className="text-xs text-red-600">{errors.cep.message}</p> : null}
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="logradouro">
                  Logradouro
                </label>
                <input
                  id="logradouro"
                  type="text"
                  placeholder="Rua / Av."
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  {...register("logradouro")}
                />
                {errors.logradouro ? <p className="text-xs text-red-600">{errors.logradouro.message}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="numero">
                  Número
                </label>
                <input
                  id="numero"
                  type="text"
                  placeholder="No."
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  {...register("numero")}
                />
                {errors.numero ? <p className="text-xs text-red-600">{errors.numero.message}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="bairro">
                  Bairro
                </label>
                <input
                  id="bairro"
                  type="text"
                  placeholder="Bairro"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  {...register("bairro")}
                />
                {errors.bairro ? <p className="text-xs text-red-600">{errors.bairro.message}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="cidade">
                  Cidade
                </label>
                <input
                  id="cidade"
                  type="text"
                  placeholder="Cidade"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  {...register("cidade")}
                />
                {errors.cidade ? <p className="text-xs text-red-600">{errors.cidade.message}</p> : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="profissional@exemplo.com"
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                {...register("email", {
                  setValueAs: (value: string) => (value?.trim() ? value : null),
                })}
              />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="especialidade">
                Especialidade
              </label>
              <select
                id="especialidade"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[var(--texto)] outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                {...register("especialidade")}
              >
                <option value="">Selecione</option>
                {ESPECIALIDADES_PROFISSIONAL.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.especialidade ? <p className="text-xs text-red-600">{errors.especialidade.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold text-[var(--marrom)]" htmlFor="observacao">
                Observação
              </label>
              <textarea
                id="observacao"
                rows={4}
                placeholder="Observações adicionais sobre o profissional"
                className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                {...register("observacao")}
              />
              {errors.observacao ? <p className="text-xs text-red-600">{errors.observacao.message}</p> : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 md:col-span-2">
              {msg ? <p className="text-sm text-red-600">{msg}</p> : <span />}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={clearForm}
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar profissional"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="rounded-xl bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Resumo</p>
            <h4 className="text-lg font-semibold text-[var(--marrom)]">Ficha do profissional</h4>
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
                <span className="text-gray-500">Endereço</span>
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
              <strong className="text-[var(--texto)]">{String(email ?? "").trim() || "-"}</strong>
            </div>
            <div className="flex flex-col border-b border-gray-100 pb-3">
              <span className="text-gray-500">Observação</span>
              <strong className="text-[var(--texto)] whitespace-pre-wrap break-words">
                {String(observacao ?? "").trim() || "-"}
              </strong>
            </div>
            <div className="rounded-lg border border-[#f1e1c7] bg-[#fff6e6] p-3 text-xs leading-relaxed text-[var(--marrom)]">
              Os dados são salvos na base de profissionais e podem ser consultados ou editados pela equipe.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}



