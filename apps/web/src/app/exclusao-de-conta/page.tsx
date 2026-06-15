import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Exclusão de conta — Girassóis+",
  description:
    "Como solicitar a exclusão da sua conta e dos dados associados no aplicativo Girassóis+.",
};

// TODO(clínica): confirmar e-mail oficial de contato.
const CONTACT_EMAIL = "girassoisclinica@gmail.com";

export default function ExclusaoDeContaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-900">Exclusão de conta</h1>
      <p className="mt-4">
        O Girassóis+ é de uso restrito à Clínica Girassóis e <strong>não permite cadastro
        público</strong> — as contas são criadas pela clínica. Você pode solicitar a
        exclusão da sua conta e dos dados pessoais associados a ela a qualquer momento.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Como solicitar</h2>
      <p className="mt-3">
        Envie uma mensagem para{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-600 underline">
          {CONTACT_EMAIL}
        </a>{" "}
        a partir do e-mail cadastrado, com o assunto &quot;Exclusão de conta&quot;.
        Confirmamos a identidade e concluímos a exclusão em até 30 dias.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">O que é excluído</h2>
      <p className="mt-3">
        Excluímos os dados de cadastro da conta (nome, e-mail, credenciais) e os vínculos
        associados. Registros clínicos de pacientes (anamnese, prontuário, evoluções) e
        trilhas de auditoria podem ser retidos quando houver obrigação legal ou guarda de
        prontuário aplicável; nesse caso, são desvinculados da sua conta de acesso.
      </p>

      <p className="mt-8 text-sm text-slate-500">
        Consulte também a{" "}
        <Link href="/privacidade" className="text-amber-600 underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </main>
  );
}
