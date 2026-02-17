"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setLoading(false);

    if (!result || result.error) {
      setError("Credenciais invalidas.");
      return;
    }

    window.location.href = result.url ?? "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cinza)] px-4 text-[var(--texto)]">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-lg md:grid-cols-2">
        <section className="flex flex-col justify-between bg-gradient-to-br from-[var(--amarelo)] to-[var(--laranja)] p-10 text-white">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/sunflower-svgrepo-com.svg"
              alt="Logo Girassol"
              width={80}
              height={80}
              className="h-20 w-20 rounded-2xl bg-white p-3 shadow-lg"
            />
            <h1 className="mt-6 text-3xl font-bold">Clinica Girassois</h1>
            <p className="mt-3 leading-relaxed text-white/90">
              Faca login para acessar cadastros, agenda e prontuario clinico.
            </p>
          </div>
          <p className="text-sm text-white/80">Suporte: contato@girassois.com.br</p>
        </section>

        <section className="bg-white p-10">
          <h2 className="mb-2 text-2xl font-bold text-[var(--marrom)]">Bem-vindo(a)</h2>
          <p className="mb-6 text-sm text-gray-600">
            Entre com suas credenciais para continuar.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-[var(--marrom)]">
                E-mail
              </label>
              <input
                id="email"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seuemail@exemplo.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-[var(--marrom)]">
                Senha
              </label>
              <input
                id="password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--laranja)] py-2.5 font-semibold text-white transition hover:bg-[#e6961f] disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
