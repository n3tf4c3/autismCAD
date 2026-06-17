import { useEffect, useState } from "react";
import {
  clinicTimeResponseSchema,
  type ClinicTimeResponse,
} from "@autismcad/validators/api/v1";
import { useAuth } from "@/auth/AuthContext";

// Achado 77: busca a data "hoje" da clinica (fuso do servidor) uma vez. Enquanto nao
// carrega — ou se falhar/offline — retorna null e a tela cai para o relogio do aparelho.
export function useClinicToday(): string | null {
  const { authFetch } = useAuth();
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authFetch<ClinicTimeResponse>("/api/v1/time", { schema: clinicTimeResponseSchema })
      .then((res) => {
        if (active) setToday(res.today ?? null);
      })
      .catch(() => {
        // offline/erro: mantem null; a tela usa a data do aparelho.
      });
    return () => {
      active = false;
    };
  }, [authFetch]);

  return today;
}
