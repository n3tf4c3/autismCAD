import { API_BASE_URL } from "@/config";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ApiRequest = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | null | undefined>;
  // Achado 113: timeout padrao (ms) e cancelamento opcional por chamada.
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 15000;

function buildUrl(path: string, query?: ApiRequest["query"]): string {
  const url = new URL(path.replace(/^\//, ""), API_BASE_URL.replace(/\/?$/, "/"));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequest = {}
): Promise<T> {
  const { method = "GET", body, token, query, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  // Achado 113: aborta apos timeoutMs (ou quando o signal externo abortar), evitando
  // telas presas em loading em rede ruim.
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError("Tempo de conexao esgotado. Tente novamente.", 0, "TIMEOUT");
    }
    if (controller.signal.aborted) {
      throw new ApiError("Requisicao cancelada.", 0, "ABORTED");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ?? `Erro ${response.status}`;
    const code =
      data && typeof data === "object" && "code" in data
        ? String((data as { code: unknown }).code)
        : undefined;
    throw new ApiError(message, response.status, code);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
