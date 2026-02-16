"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useShell } from "@/components/shell/shell-provider.client";
import { canonicalRoleName } from "@/server/auth/permissions";

type NavItem = {
  key: string;
  label: string;
  icon: string;
  href?: string;
  kind?: "link" | "action" | "separator";
  onClick?: () => void;
  activeWhen?: (pathname: string) => boolean;
};

function joinClass(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isActivePrefix(prefix: string, pathname: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function Modal(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      {props.children}
    </div>
  );
}

export function SidebarClient(props: { userRole?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const shell = useShell();
  const roleCanon = canonicalRoleName(props.userRole) ?? props.userRole ?? null;
  const isAdminGeral = roleCanon === "ADMIN_GERAL";

  const items: NavItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "🏠",
      href: "/",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/", p),
    },
    {
      key: "cadastros",
      label: "Cadastros",
      icon: "📁",
      kind: "action",
      onClick: () => {
        setCadastrosOpen(true);
        shell.closeSidebar();
      },
      // "Cadastros" opens a modal, so it should only look active while the modal is open.
      // Otherwise it double-highlights together with "Pacientes"/"Terapeutas".
      activeWhen: () => cadastrosOpen,
    },
    {
      key: "pacientes",
      label: "Pacientes",
      icon: "👥",
      href: "/pacientes",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/pacientes", p),
    },
    {
      key: "terapeutas",
      label: "Terapeutas",
      icon: "🧑‍⚕️",
      href: "/terapeutas",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/terapeutas", p),
    },
    {
      key: "consultas",
      label: "Consultas",
      icon: "🔎",
      href: "/consultas",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/consultas", p),
    },
    {
      key: "calendario",
      label: "Calendario",
      icon: "📅",
      href: "/calendario",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/calendario", p),
    },
    { key: "sep1", label: "-", icon: "", kind: "separator" },
    {
      key: "relatorios",
      label: "Relatorios",
      icon: "📊",
      href: "/relatorios",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/relatorios", p),
    },
    {
      key: "configuracoes",
      label: "Configuracoes",
      icon: "⚙",
      href: "/configuracoes",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/configuracoes", p),
    },
    ...(isAdminGeral
      ? [
          {
            key: "logs-acesso",
            label: "Log de acessos",
            icon: "LG",
            href: "/logs-acesso",
            kind: "link",
            activeWhen: (p: string) => isActivePrefix("/logs-acesso", p),
          } satisfies NavItem,
        ]
      : []),
    {
      key: "logout",
      label: "Sair",
      icon: "🚪",
      kind: "action",
      onClick: () => {
        shell.closeSidebar();
        void signOut({ callbackUrl: "/login" });
      },
    },
  ];

  function renderItem(item: NavItem) {
    if (item.kind === "separator") {
      return <div key={item.key} className="my-2 border-t border-white/20" />;
    }

    const active = item.activeWhen ? item.activeWhen(pathname) : false;
    const base =
      // `w-full` keeps hover/active backgrounds consistent across <Link> and <button> items.
      "sidebar-link flex w-full items-center gap-3 rounded-md px-3 py-2 text-base font-semibold transition";
    const cls = joinClass(
      base,
      active ? "bg-white/10" : "bg-transparent",
      "text-white hover:bg-white hover:text-[var(--laranja)] hover:translate-x-[2px]"
    );

    const content = (
      <>
        <span className="nav-icon inline-flex h-6 w-6 items-center justify-center text-[1.35rem] leading-none">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </>
    );

    if (item.kind === "action") {
      return (
        <button
          type="button"
          key={item.key}
          className={joinClass(cls, "text-left")}
          onClick={item.onClick}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href ?? "#"}
        className={cls}
        onClick={() => shell.closeSidebar()}
      >
        {content}
      </Link>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 z-30 hidden w-64 flex-col bg-[var(--laranja)] text-white md:flex">
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <Image
            src="/sunflower-svgrepo-com.svg"
            alt="Logo Girassol"
            width={96}
            height={96}
            className="h-24 w-24 rounded-xl bg-white p-2 drop-shadow-lg"
            priority
          />
          <h1 className="text-lg font-bold tracking-wide text-white">Clinica Girassois</h1>
        </div>

        <nav className="flex-1 space-y-1 px-3">{items.map(renderItem)}</nav>

        <div className="p-4 text-xs text-white/90">
          <p className="font-semibold">Suporte</p>
          <p>contato@clinicagirassois.com</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className="md:hidden">
        <div
          className={[
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity",
            shell.sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) shell.closeSidebar();
          }}
        />

        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--laranja)] text-white shadow-xl transition-transform duration-200 ease-out",
            shell.sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3 px-6 py-6">
            <div className="flex items-center gap-3">
              <Image
                src="/sunflower-svgrepo-com.svg"
                alt="Logo Girassol"
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl bg-white p-2 drop-shadow-lg"
                priority
              />
              <p className="text-sm font-bold tracking-wide text-white">Clinica Girassois</p>
            </div>
            <button
              type="button"
              className="text-2xl leading-none text-white/90 hover:text-white"
              onClick={shell.closeSidebar}
              aria-label="Fechar menu"
            >
              &times;
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3">{items.map(renderItem)}</nav>

          <div className="p-4 text-xs text-white/90">
            <p className="font-semibold">Suporte</p>
            <p>contato@clinicagirassois.com</p>
          </div>
        </aside>
      </div>

      <Modal open={cadastrosOpen} onClose={() => setCadastrosOpen(false)}>
        <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Cadastros</p>
              <h2 className="text-lg font-semibold text-[var(--marrom)]">
                O que voce quer abrir?
              </h2>
            </div>
            <button
              type="button"
              className="text-2xl leading-none text-gray-500 hover:text-[var(--laranja)]"
              onClick={() => setCadastrosOpen(false)}
              aria-label="Fechar"
            >
              &times;
            </button>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-[var(--laranja)] hover:bg-[#fff6e6]"
              onClick={() => {
                setCadastrosOpen(false);
                shell.closeSidebar();
                router.push("/pacientes/novo");
              }}
            >
              <p className="text-sm font-semibold text-[var(--marrom)]">Paciente</p>
              <p className="text-xs text-gray-600">Registrar ou editar dados do paciente.</p>
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-[var(--laranja)] hover:bg-[#fff6e6]"
              onClick={() => {
                setCadastrosOpen(false);
                shell.closeSidebar();
                router.push("/terapeutas/novo");
              }}
            >
              <p className="text-sm font-semibold text-[var(--marrom)]">Terapeuta</p>
              <p className="text-xs text-gray-600">Cadastrar profissional e especialidade.</p>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
