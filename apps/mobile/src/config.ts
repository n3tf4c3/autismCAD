import Constants from "expo-constants";

// Base da API. Resolucao, em ordem:
// 1) EXPO_PUBLIC_API_BASE_URL — permite sobrepor por build/ambiente sem editar
//    app.json (achado 78); o Expo inlina variaveis EXPO_PUBLIC_* no bundle.
// 2) app.config.js/app.json > expo.extra.apiBaseUrl — valor resolvido no build.
//    Builds preview falham na avaliacao da config se a URL estiver ausente ou
//    apontar para producao (achado 146).
// 3) 10.0.2.2 = loopback do host no emulador Android (aponta para o `next dev`).
//    Em device fisico, use http://<ip-da-maquina>:3000.
const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

export const API_BASE_URL = fromEnv ?? fromExtra ?? "http://10.0.2.2:3000";
