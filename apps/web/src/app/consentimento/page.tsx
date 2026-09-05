import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/auth";
import { AppError } from "@/server/shared/errors";
import { aceitarConsentimentoAction } from "./consentimento.actions";
import {
  isPolicyConsentRequired,
} from "@/server/modules/consent/consent.service";

export const metadata: Metadata = {
  title: "Consentimento — Girassóis+",
};

export default async function ConsentimentoPage() {
  const user = await requireUser({ skipConsentGate: true }).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  });
  const userId = user.id;
  // Já consentiu a versão vigente: não há o que fazer aqui.
  if (!(await isPolicyConsentRequired(userId))) redirect("/dashboard");


  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Consentimento de dados</h1>
      <p className="mt-4">
        O Girassóis+ trata dados pessoais e <strong>dados de saúde</strong> para o
        acompanhamento clínico. Para continuar, você precisa ler e concordar com a nossa
        Política de Privacidade.
      </p>
      <p className="mt-3">
        Leia a{" "}
        <Link href="/privacidade" className="text-amber-600 underline" target="_blank">
          Política de Privacidade
        </Link>{" "}
        antes de prosseguir. Você pode revogar o consentimento depois pelos canais
        indicados na política.
      </p>

      <form action={aceitarConsentimentoAction} className="mt-8">
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-white hover:bg-amber-600"
        >
          Li e concordo — continuar
        </button>
      </form>
    </main>
  );
}
