"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

function SidebarBgArt(props?: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 900"
      className={props?.className ?? "pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"}
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="sbGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="68" cy="110" r="96" fill="url(#sbGlow)" />
      <circle cx="255" cy="165" r="84" fill="url(#sbGlow)" />
      <circle cx="220" cy="705" r="120" fill="url(#sbGlow)" />
      <circle cx="85" cy="740" r="56" fill="none" stroke="white" strokeWidth="8" />
      <circle cx="92" cy="746" r="18" fill="white" />
      <circle cx="238" cy="348" r="34" fill="none" stroke="white" strokeWidth="6" />
      <path
        d="M18 288 C75 250, 118 334, 176 296 S262 260, 306 300"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M32 448 C96 388, 130 500, 194 444 S256 396, 296 430"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g>
        <circle cx="110" cy="530" r="6" fill="white" />
        <circle cx="138" cy="520" r="4" fill="white" />
        <circle cx="164" cy="538" r="5" fill="white" />
        <circle cx="190" cy="526" r="4" fill="white" />
      </g>
    </svg>
  );
}
export function SidebarClient(props: { userRole?: string | null }) {
  const pathname = usePathname();
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
      key: "calendario",
      label: "Agenda",
      icon: "📅",
      href: "/calendario",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/calendario", p),
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
      key: "relatorios",
      label: "Resultados",
      icon: "📊",
      href: "/relatorios",
      kind: "link",
      activeWhen: (p) => isActivePrefix("/relatorios", p),
    },
    { key: "sep1", label: "-", icon: "", kind: "separator" },
    {
      key: "configuracoes",
      label: "Controle",
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
      <aside className="fixed inset-y-0 z-30 hidden w-64 flex-col overflow-hidden bg-gradient-to-b from-[#FFD966] via-[#7FB3FF] to-[#6DD3C7] text-white md:flex">
        <SidebarBgArt />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.14),transparent_42%)]" />
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8">
          <Image
            src="/sunflower-svgrepo-com.svg"
            alt="Logo Girassol"
            width={96}
            height={96}
            className="h-24 w-24 rounded-xl bg-white p-2 drop-shadow-lg transition-transform duration-300 hover:rotate-3 hover:scale-105"
            priority
          />
          <h1 className="text-lg font-bold tracking-wide text-white">Clínica Girassóis</h1>
        </div>

        <nav className="relative z-10 flex-1 space-y-1 px-3">{items.map(renderItem)}</nav>

        <div className="relative z-10 p-4 text-xs text-white/90">
          <p className="font-semibold">Suporte</p>
          <p className="text-sm font-bold text-white">suporte@girassois.com.br</p>
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
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-gradient-to-b from-[#FFD966] via-[#7FB3FF] to-[#6DD3C7] text-white shadow-xl transition-transform duration-200 ease-out",
            shell.sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <SidebarBgArt />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.14),transparent_42%)]" />
          <div className="relative z-10 flex items-start justify-between gap-3 px-6 py-6">
            <div className="flex items-center gap-3">
              <Image
                src="/sunflower-svgrepo-com.svg"
                alt="Logo Girassol"
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl bg-white p-2 drop-shadow-lg transition-transform duration-300 hover:rotate-3 hover:scale-105"
                priority
              />
              <p className="text-sm font-bold tracking-wide text-white">Clínica Girassóis</p>
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

          <nav className="relative z-10 flex-1 space-y-1 px-3">{items.map(renderItem)}</nav>

          <div className="relative z-10 p-4 text-xs text-white/90">
            <p className="font-semibold">Suporte</p>
            <p className="text-sm font-bold text-white">suporte@girassois.com.br</p>
          </div>
        </aside>
      </div>

    </>
  );
}
