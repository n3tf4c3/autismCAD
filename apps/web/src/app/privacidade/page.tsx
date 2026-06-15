import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Girassóis+",
  description:
    "Como a Clínica Girassóis coleta, usa, compartilha e protege os dados pessoais no aplicativo Girassóis+ e na plataforma web.",
};

// Versão da política. Ao alterar o conteúdo, suba a versão e a data — o app usa isso
// para exigir reconsentimento (ver plano de lançamento, bloco LGPD).
const POLICY_VERSION = "1.0";
const POLICY_DATE = "15 de junho de 2026";
// TODO(clínica): confirmar razão social, CNPJ, endereço e e-mail do encarregado (DPO).
const CONTROLLER = "Clínica Girassóis";
const CONTACT_EMAIL = "girassoisclinica@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-slate-700">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-700">
      <p className="text-sm text-slate-500">
        Versão {POLICY_VERSION} · atualizada em {POLICY_DATE}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Política de Privacidade</h1>
      <p className="mt-4">
        Esta política descreve como o <strong>{CONTROLLER}</strong> (&quot;nós&quot;), na
        condição de controlador, trata os dados pessoais coletados pelo aplicativo
        <strong> Girassóis+</strong> e pela plataforma web associada, em conformidade com a
        Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>
      <p className="mt-3">
        O Girassóis+ é de uso restrito ao <strong>{CONTROLLER}</strong>: o acesso é limitado
        a profissionais e responsáveis autorizados, e <strong>não há cadastro público</strong>
        — as contas são criadas e administradas pela própria clínica.
      </p>

      <Section title="1. Dados que coletamos">
        <p>Tratamos os seguintes dados, conforme o seu papel na plataforma:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Conta de acesso</strong> (profissionais e responsáveis): nome, e-mail e
            senha (armazenada de forma criptografada).
          </li>
          <li>
            <strong>Pacientes</strong>: nome, CPF, data de nascimento, e-mail, telefone(s),
            foto e laudo.
          </li>
          <li>
            <strong>Profissionais/terapeutas</strong>: nome, CPF, data de nascimento,
            e-mail, telefone, endereço, CEP e cidade.
          </li>
          <li>
            <strong>Dados de saúde (sensíveis)</strong>: anamnese, documentos de prontuário
            e registros de evolução terapêutica dos pacientes.
          </li>
          <li>
            <strong>Registros de uso</strong>: logs de acesso (e-mail e trilha de eventos)
            para segurança e auditoria.
          </li>
        </ul>
      </Section>

      <Section title="2. Para que usamos os dados">
        <ul className="list-disc space-y-1 pl-6">
          <li>Prestar o serviço de acompanhamento clínico (agenda, evoluções e devolutivas).</li>
          <li>Autenticar usuários e manter a segurança das contas.</li>
          <li>Vincular responsáveis aos respectivos pacientes.</li>
          <li>Gerar relatórios e devolutivas para a equipe e a família.</li>
          <li>Cumprir obrigações legais e registrar trilhas de auditoria.</li>
        </ul>
      </Section>

      <Section title="3. Base legal e consentimento">
        <p>
          O tratamento de dados comuns ocorre para execução do serviço e cumprimento de
          obrigações legais. O tratamento de <strong>dados de saúde</strong>, por serem
          sensíveis, ocorre mediante <strong>consentimento específico e destacado</strong>,
          colhido pela clínica no momento do onboarding clínico (termo de consentimento do
          responsável/paciente). Você pode revogar o consentimento a qualquer momento pelos
          canais abaixo; a revogação pode impedir o uso do serviço quando o dado for
          essencial ao acompanhamento.
        </p>
      </Section>

      <Section title="4. Compartilhamento e operadores">
        <p>
          Não vendemos dados pessoais. Compartilhamos dados apenas com prestadores que nos
          apoiam na operação (operadores), sob contrato e instruções:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Cloudflare R2</strong> — armazenamento de arquivos (ex.: fotos e laudos).</li>
          <li><strong>Vercel</strong> — hospedagem da aplicação web e da API.</li>
        </ul>
        <p className="text-sm text-slate-500">
          TODO(clínica): revisar e completar esta lista de subprocessadores conforme a
          infraestrutura efetiva.
        </p>
      </Section>

      <Section title="5. Segurança e transferência">
        <p>
          Os dados trafegam por conexões criptografadas (HTTPS) e o acesso é restrito por
          autenticação e perfis de permissão. Senhas são armazenadas com hash.
        </p>
      </Section>

      <Section title="6. Retenção e exclusão de conta">
        <p>
          Mantemos os dados pelo tempo necessário às finalidades acima e às obrigações
          legais. Você pode solicitar a exclusão da sua conta e dos dados associados a
          qualquer momento:
        </p>
        <p>
          Consulte a página de{" "}
          <Link href="/exclusao-de-conta" className="text-amber-600 underline">
            exclusão de conta
          </Link>{" "}
          para o passo a passo.
        </p>
      </Section>

      <Section title="7. Seus direitos (LGPD)">
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção, anonimização,
          portabilidade, informação sobre compartilhamentos e exclusão dos seus dados,
          assim como revogar consentimento.
        </p>
      </Section>

      <Section title="8. Contato e encarregado">
        <p>
          Para exercer seus direitos ou tirar dúvidas sobre esta política, fale com o{" "}
          <strong>{CONTROLLER}</strong> pelo e-mail{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-600 underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="text-sm text-slate-500">
          TODO(clínica): incluir razão social, CNPJ, endereço e o contato do encarregado
          (DPO), se aplicável.
        </p>
      </Section>

      <Section title="9. Alterações">
        <p>
          Podemos atualizar esta política. Mudanças relevantes elevam a versão acima e, no
          caso de dados sensíveis, podem exigir novo consentimento para continuar usando o
          serviço.
        </p>
      </Section>
    </main>
  );
}
