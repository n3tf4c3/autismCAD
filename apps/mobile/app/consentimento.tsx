import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { API_BASE_URL } from "@/config";
import { BrandHero, Button, ErrorText, Muted, Screen, theme } from "@/ui";

const PRIVACY_URL = `${API_BASE_URL.replace(/\/?$/, "")}/privacidade`;

export default function Consentimento() {
  const { authFetch, markConsentAccepted } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceitar() {
    setError(null);
    setBusy(true);
    try {
      await authFetch("/api/v1/consentimento", { method: "POST" });
      await markConsentAccepted();
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao registrar o consentimento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ height: 12 }} />
      <BrandHero title="Girassóis+" tagline="Cuidado e desenvolvimento" />
      <View style={{ height: 8 }} />
      <Text style={{ color: theme.accent, fontSize: 22, fontWeight: "800" }}>
        Consentimento de dados
      </Text>
      <Muted>
        O Girassóis+ trata dados pessoais e de saúde para o acompanhamento clínico. Para
        continuar, leia e concorde com a nossa Política de Privacidade.
      </Muted>
      <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={{ paddingVertical: 8 }}>
        <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "700" }}>
          Ler a Política de Privacidade
        </Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
      <Button title="Li e concordo — continuar" onPress={aceitar} loading={busy} />
    </Screen>
  );
}
