import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { BrandHero, Button, ErrorText, Field, Muted, Screen, theme } from "@/ui";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Falha ao entrar. Verifique a conexao."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ height: 12 }} />
      <BrandHero title="Girassóis+" tagline="Cuidado e desenvolvimento" />
      <View style={{ height: 8 }} />
      <Text style={{ color: theme.accent, fontSize: 24, fontWeight: "800" }}>Bem-vindo(a)</Text>
      <Muted>Entre com suas credenciais.</Muted>
      <View style={{ height: 4 }} />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="voce@exemplo.com"
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="********"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={onSubmit} loading={busy} disabled={!email || !password} />
      <Pressable
        onPress={() =>
          Alert.alert(
            "Esqueci minha senha",
            "Para redefinir sua senha, fale com a administração da clínica."
          )
        }
        style={{ alignSelf: "center", paddingVertical: 8 }}
      >
        <Text style={{ color: theme.muted, fontSize: 13 }}>Esqueci minha senha</Text>
      </Pressable>
    </Screen>
  );
}
