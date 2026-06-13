import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { roleCanon, useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { Button, ErrorText, Field, H1, Muted, Screen } from "@/ui";

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
      <View style={{ height: 40 }} />
      <H1>AutismCAD</H1>
      <Muted>Acesse com seu e-mail e senha.</Muted>
      <View style={{ height: 12 }} />
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
    </Screen>
  );
}
