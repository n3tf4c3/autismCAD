const PRODUCTION_API_BASE_URL = "https://www.girassois.com.br";
const LOCAL_API_BASE_URL = "http://10.0.2.2:3000";

function normalizeUrl(rawValue, label) {
  const value = String(rawValue ?? "").trim();
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} deve ser uma URL http(s) valida.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} deve usar http ou https.`);
  }

  return parsed.toString().replace(/\/$/, "");
}

function resolveApiBaseUrl({ appVariant, publicApiBaseUrl, fallbackApiBaseUrl }) {
  const variant = String(appVariant ?? "local").trim().toLowerCase() || "local";
  const configured = normalizeUrl(publicApiBaseUrl, "EXPO_PUBLIC_API_BASE_URL");
  const fallback =
    normalizeUrl(fallbackApiBaseUrl, "expo.extra.apiBaseUrl") ?? LOCAL_API_BASE_URL;
  const production = normalizeUrl(PRODUCTION_API_BASE_URL, "URL de producao");

  if (variant === "preview") {
    if (!configured) {
      throw new Error(
        "Build preview exige EXPO_PUBLIC_API_BASE_URL no ambiente preview da EAS."
      );
    }
    if (configured === production) {
      throw new Error("Build preview nao pode usar a API de producao.");
    }
  }

  return configured ?? fallback;
}

function resolveExpoConfig({ config, env }) {
  const appVariant = String(env.APP_VARIANT ?? "local").trim().toLowerCase() || "local";
  const apiBaseUrl = resolveApiBaseUrl({
    appVariant,
    publicApiBaseUrl: env.EXPO_PUBLIC_API_BASE_URL,
    fallbackApiBaseUrl: config.extra?.apiBaseUrl,
  });

  return {
    ...config,
    extra: {
      ...config.extra,
      apiBaseUrl,
      appVariant,
    },
  };
}

module.exports = {
  LOCAL_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
  resolveExpoConfig,
};
