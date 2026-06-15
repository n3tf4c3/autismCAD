import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { roleCanon, useAuth } from "@/auth/AuthContext";
import { theme } from "@/ui";

// Porta de entrada: decide o destino conforme auth e papel.
export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
    const role = roleCanon(user.role);
    if (role === "RESPONSAVEL") router.replace("/pacientes");
    else router.replace("/agenda");
  }, [user, loading, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}
