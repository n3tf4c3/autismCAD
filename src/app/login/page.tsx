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
        <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#FFD966] via-[#7FB3FF] to-[#6DD3C7] p-10 text-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 520 520"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
          >
            <defs>
              <radialGradient id="loginGlowReact" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="110" cy="110" r="120" fill="url(#loginGlowReact)" />
            <circle cx="430" cy="120" r="90" fill="url(#loginGlowReact)" />
            <circle cx="410" cy="410" r="130" fill="url(#loginGlowReact)" />
            <circle cx="135" cy="385" r="60" fill="none" stroke="white" strokeWidth="10" />
            <circle cx="145" cy="390" r="24" fill="white" />
            <circle cx="330" cy="155" r="42" fill="none" stroke="white" strokeWidth="8" />
            <path
              d="M40 280 C120 220, 180 340, 260 280 S390 220, 480 290"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M70 170 C150 120, 210 210, 280 175 S390 125, 455 170"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <g>
              <circle cx="235" cy="350" r="8" fill="white" />
              <circle cx="270" cy="338" r="5" fill="white" />
              <circle cx="305" cy="360" r="7" fill="white" />
              <circle cx="338" cy="344" r="4" fill="white" />
            </g>
          </svg>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.24),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,0.14),transparent_48%)]" />

          <div className="relative z-10 flex flex-col items-center text-center">
            <Image
              src="/sunflower-svgrepo-com.svg"
              alt="Logo Girassol"
              width={80}
              height={80}
              className="h-20 w-20 rounded-2xl bg-white p-3 shadow-lg transition-transform duration-300 hover:rotate-3 hover:scale-105"
            />
            <h1 className="mt-6 text-3xl font-bold">Clinica Girassois</h1>
            <p className="mt-4 font-medium leading-relaxed text-white/95">
              Plataforma de cuidado e desenvolvimento.
            </p>
            <p className="mt-2 max-w-xs leading-relaxed text-white/90">
              Acompanhe cada passo da evolucao com carinho e precisao.
            </p>
          </div>
          <p className="relative z-10 text-base font-bold text-white">Suporte: suporte@girassois.com.br</p>
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
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm outline-none transition focus:border-[#7FB3FF] focus:ring-2 focus:ring-[#7FB3FF]/30"
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
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm outline-none transition focus:border-[#7FB3FF] focus:ring-2 focus:ring-[#7FB3FF]/30"
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
              className="w-full rounded-lg bg-gradient-to-r from-[var(--laranja)] to-[#ffcc66] py-2.5 font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
