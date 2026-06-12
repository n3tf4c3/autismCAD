"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ShellState = {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider(props: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const value = useMemo<ShellState>(() => {
    return {
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),
      toggleSidebar: () => setSidebarOpen((v) => !v),
    };
  }, [sidebarOpen]);

  return <ShellContext.Provider value={value}>{props.children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within <ShellProvider />");
  }
  return ctx;
}

