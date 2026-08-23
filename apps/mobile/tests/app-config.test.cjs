const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LOCAL_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
  resolveExpoConfig,
} = require("../config/resolve-api-base-url.cjs");

test("mantem o fallback versionado fora do preview", () => {
  assert.equal(
    resolveApiBaseUrl({
      appVariant: "production",
      fallbackApiBaseUrl: PRODUCTION_API_BASE_URL,
    }),
    PRODUCTION_API_BASE_URL
  );
  assert.equal(resolveApiBaseUrl({ appVariant: "local" }), LOCAL_API_BASE_URL);
});

test("preview falha sem URL explicita", () => {
  assert.throws(
    () =>
      resolveApiBaseUrl({
        appVariant: "preview",
        fallbackApiBaseUrl: PRODUCTION_API_BASE_URL,
      }),
    /preview exige EXPO_PUBLIC_API_BASE_URL/
  );
});

test("preview rejeita a URL de producao mesmo com barra final", () => {
  assert.throws(
    () =>
      resolveApiBaseUrl({
        appVariant: "preview",
        publicApiBaseUrl: `${PRODUCTION_API_BASE_URL}/`,
        fallbackApiBaseUrl: PRODUCTION_API_BASE_URL,
      }),
    /preview nao pode usar a API de producao/
  );
});

test("preview injeta uma origem de staging valida no Expo config", () => {
  const resolved = resolveExpoConfig({
    config: { name: "Girassois+", extra: { apiBaseUrl: PRODUCTION_API_BASE_URL } },
    env: {
      APP_VARIANT: "preview",
      EXPO_PUBLIC_API_BASE_URL: "https://staging.girassois.example/",
    },
  });

  assert.equal(resolved.extra.apiBaseUrl, "https://staging.girassois.example");
  assert.equal(resolved.extra.appVariant, "preview");
});
