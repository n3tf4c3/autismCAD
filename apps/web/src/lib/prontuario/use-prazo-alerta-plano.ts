"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isPrazoAlertaPlanoEnsino, PRAZO_ALERTA_PLANO_ENSINO_PADRAO } from "@autismcad/validators/prontuario/plano-ensino-alertas";

const changeEvent = "autismcad:prazo-alerta-plano";
const fallback = new Map<string, number>();
const serverSnapshot = () => PRAZO_ALERTA_PLANO_ENSINO_PADRAO;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

export function usePrazoAlertaPlano(userId: number) {
  const key = `autismcad:plano-ensino:antecedencia:${userId}`;
  const getSnapshot = useCallback(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return isPrazoAlertaPlanoEnsino(saved) ? saved : (fallback.get(key) ?? PRAZO_ALERTA_PLANO_ENSINO_PADRAO);
    } catch {
      return fallback.get(key) ?? PRAZO_ALERTA_PLANO_ENSINO_PADRAO;
    }
  }, [key]);
  const dias = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);

  function setDias(value: number) {
    if (!isPrazoAlertaPlanoEnsino(value)) return;
    try {
      localStorage.setItem(key, String(value));
      fallback.delete(key);
    } catch {
      fallback.set(key, value);
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  return [dias, setDias] as const;
}
