import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { roleCanon, useAuth } from "@/auth/AuthContext";
import { theme } from "@/ui";

type Area = "profissional" | "responsavel";

// Espelha o roteamento de index.tsx: RESPONSAVEL fica na area do responsavel;
// os demais papeis (profissional/admin) ficam na area profissional.
function areaAllowsRole(area: Area, role: string): boolean {
  return area === "responsavel" ? role === "RESPONSAVEL" : role !== "RESPONSAVEL";
}

// Guarda central de rotas autenticadas (achados 84, 97): aguarda a hidratacao dos
// tokens, redireciona para /login sem usuario, exige consentimento e valida a
// area/papel antes de montar o conteudo. Como o conteudo so monta quando liberado,
// chamadas de API por telas filhas tambem nao disparam antes da auth hidratar.
export function AuthGuard({ area, children }: { area: Area; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const role = user ? roleCanon(user.role) : null;
  const allowed =
    !loading && !!user && !user.consentRequired && !!role && areaAllowsRole(area, role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.consentRequired) {
      router.replace("/consentimento");
      return;
    }
    if (role && !areaAllowsRole(area, role)) {
      // papel sem acesso a esta area: a porta de entrada decide o destino correto.
      router.replace("/");
    }
  }, [user, loading, role, area, router]);

  if (!allowed) {
    return (
      <View
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  return <>{children}</>;
}
