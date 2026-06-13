import Constants from "expo-constants";

// Base da API. Padrao 10.0.2.2 = loopback do host no emulador Android (aponta para o
// `next dev` rodando na maquina). Em device fisico, troque por http://<ip-da-maquina>:3000
// ou a URL de deploy, via app.json > expo.extra.apiBaseUrl.
const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

export const API_BASE_URL = fromExtra ?? "http://10.0.2.2:3000";
