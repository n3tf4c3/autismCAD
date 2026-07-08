import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth/session";
import { parseSessionUserId } from "@/server/auth/user-id";
import {
  acceptCurrentPolicy,
  isPolicyConsentRequired,
} from "@/server/modules/consent/consent.service";

export const metadata: Metadata = {
  title: "Consentimento — Girassóis+",
};

export default async function ConsentimentoPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login");
  const userId = parseSessionUserId(session.user.id);
  // Já consentiu a versão vigente: não há o que fazer aqui.
  if (!(await isPolicyConsentRequired(userId))) redirect("/dashboard");

  async function aceitar() {
    "use server";
    const s = await getAuthSession();
    if (!s?.user?.id) redirect("/login");
    await acceptCurrentPolicy(parseSessionUserId(s.user.id));
    redirect("/dashboard");
  }

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

      <form action={aceitar} className="mt-8">
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
