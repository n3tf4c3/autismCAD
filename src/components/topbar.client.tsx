"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useShell } from "@/components/shell/shell-provider.client";

function roleLabel(role?: string | null): string {
  const key = String(role || "").trim().toUpperCase();
  if (key === "ADMIN" || key === "ADMIN_GERAL") return "Administrador";
  if (key === "TERAPEUTA") return "Terapeuta";
  if (key === "RECEPCAO") return "Recepcao";
  return role ? String(role) : "Usuario";
}

function pageMeta(pathname: string): { kicker: string; title: string } {
  if (pathname === "/") return { kicker: "Painel principal", title: "Bem-vindo(a)" };
  if (pathname === "/pacientes") return { kicker: "Consulta", title: "Pacientes cadastrados" };
  if (pathname.startsWith("/pacientes/")) return { kicker: "Consulta", title: "Paciente" };
  if (pathname.startsWith("/terapeutas")) return { kicker: "Cadastro", title: "Terapeutas" };
  if (pathname.startsWith("/consultas")) return { kicker: "Agenda", title: "Consultas / Sessoes" };
  if (pathname.startsWith("/calendario")) return { kicker: "Agenda", title: "Calendario" };
  if (pathname.startsWith("/prontuario")) return { kicker: "Clinico", title: "Prontuario" };
  if (pathname.startsWith("/anamnese")) return { kicker: "Clinico", title: "Anamnese" };
  if (pathname.startsWith("/relatorios/evolutivo")) return { kicker: "Relatorio evolutivo", title: "Paciente" };
  if (pathname.startsWith("/relatorios/periodo")) return { kicker: "Relatorio por periodo", title: "Consolidado" };
  if (pathname.startsWith("/relatorios/assiduidade")) return { kicker: "Relatorios", title: "Assiduidade e presenca" };
  if (pathname.startsWith("/relatorios/clinico")) return { kicker: "Relatorios", title: "Relatorio Clinico" };
  if (pathname.startsWith("/relatorios")) return { kicker: "Indicadores", title: "Relatorios" };
  if (pathname.startsWith("/configuracoes")) return { kicker: "Administracao", title: "Permissoes por papel" };
  return { kicker: "Sistema", title: "Clinica Girassois" };
}

export function TopbarClient(props: { userName: string; userRole?: string | null; initials: string }) {
  const pathname = usePathname();
  const meta = useMemo(() => pageMeta(pathname), [pathname]);
  const role = roleLabel(props.userRole);
  const shell = useShell();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-white px-4 shadow-sm md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 md:hidden"
          onClick={shell.toggleSidebar}
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <div>
          <p className="text-sm text-gray-500">{meta.kicker}</p>
          <h2 className="text-xl font-semibold text-[var(--marrom)]">{meta.title}</h2>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm text-gray-500">
            Ola, <span className="font-medium">{props.userName}</span>
          </p>
          <p className="text-sm font-semibold text-[var(--texto)]">{role}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--amarelo)] font-bold text-[var(--marrom)]">
          {props.initials}
        </div>
      </div>
    </header>
  );
}
