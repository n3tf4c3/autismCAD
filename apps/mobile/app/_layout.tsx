import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthContext";
import { theme } from "@/ui";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="consentimento" options={{ headerShown: false }} />
          <Stack.Screen name="agenda" options={{ title: "Agenda do dia" }} />
          <Stack.Screen name="evolucao" options={{ title: "Nova evolucao" }} />
          <Stack.Screen name="pacientes" options={{ title: "Pacientes" }} />
          <Stack.Screen name="devolutiva" options={{ title: "Devolutiva" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
