import "server-only";
import { desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessLogs, users } from "@/server/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import { AppError } from "@/server/shared/errors";

const DEFAULT_ACCESS_LOG_RETENTION_DAYS = 30;
const MIN_ACCESS_LOG_RETENTION_DAYS = 7;
const MAX_ACCESS_LOG_RETENTION_DAYS = 365;

function resolveAccessLogRetentionDays(): number {
  const raw = String(process.env.ACCESS_LOG_RETENTION_DAYS ?? "").trim();
  if (!raw) return DEFAULT_ACCESS_LOG_RETENTION_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_ACCESS_LOG_RETENTION_DAYS;
  const normalized = Math.trunc(parsed);
  if (normalized < MIN_ACCESS_LOG_RETENTION_DAYS) return MIN_ACCESS_LOG_RETENTION_DAYS;
  if (normalized > MAX_ACCESS_LOG_RETENTION_DAYS) return MAX_ACCESS_LOG_RETENTION_DAYS;
  return normalized;
}

export const ACCESS_LOG_RETENTION_DAYS = resolveAccessLogRetentionDays();
const ACCESS_LOG_RETENTION_MS = ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const FALLBACK_UNKNOWN_EMAIL = "nao-informado";

export const ACCESS_LOG_STATUSES = ["SUCESSO", "FALHA"] as const;
export type AccessLogStatus = (typeof ACCESS_LOG_STATUSES)[number];

type HeaderBag = Record<string, unknown> | undefined;

type LoginRequestMeta = {
  ipOrigem: string | null;
  userAgent: string | null;
  browser: string | null;
};

function retentionCutoff(now = new Date()) {
  return new Date(now.getTime() - ACCESS_LOG_RETENTION_MS);
}

function toHeaderString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function readHeader(headers: HeaderBag, headerName: string): string | null {
  if (!headers) return null;

  const direct = toHeaderString(headers[headerName]);
  if (direct) return direct;

  const lookup = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lookup) {
      return toHeaderString(value);
    }
  }
  return null;
}

function trimOrNull(value: string | null | undefined, maxLen: number): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function parseForwardedFor(value: string | null): string | null {
  if (!value) return null;
  const chunk = value.split(",")[0]?.trim();
  if (!chunk) return null;

  // X-Forwarded-For may send ipv4 with port in some proxies.
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(chunk)) {
    return chunk.split(":")[0] ?? null;
  }
  return chunk;
}

function parseForwardedHeader(value: string | null): string | null {
  if (!value) return null;
  const firstPart = value.split(",")[0] ?? "";
  const sections = firstPart.split(";");
  for (const section of sections) {
    const [rawKey, rawValue] = section.split("=");
    const key = String(rawKey || "").trim().toLowerCase();
    if (key !== "for") continue;
    const cleaned = String(rawValue || "").trim().replace(/^"|"$/g, "");
    if (!cleaned) continue;

    if (cleaned.startsWith("[")) {
      const endBracket = cleaned.indexOf("]");
      if (endBracket > 1) {
        return cleaned.slice(1, endBracket);
      }
    }
    if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(cleaned)) {
      return cleaned.split(":")[0] ?? null;
    }
    return cleaned;
  }
  return null;
}

function detectBrowser(userAgent: string | null): string | null {
  const source = String(userAgent || "").toLowerCase();
  if (!source) return null;
  if (source.includes("edg/")) return "Edge";
  if (source.includes("opr/") || source.includes("opera/")) return "Opera";
  if (source.includes("firefox/")) return "Firefox";
  if (source.includes("chrome/") || source.includes("chromium/")) return "Chrome";
  if (source.includes("safari/")) return "Safari";
  if (source.includes("trident/") || source.includes("msie")) return "Internet Explorer";
  return "Outro";
}

function extractLoginRequestMeta(headers: HeaderBag): LoginRequestMeta {
  const ipOrigem = trimOrNull(
    parseForwardedFor(readHeader(headers, "x-forwarded-for")) ??
      trimOrNull(readHeader(headers, "x-real-ip"), 64) ??
      trimOrNull(readHeader(headers, "cf-connecting-ip"), 64) ??
      parseForwardedHeader(readHeader(headers, "forwarded")) ??
      trimOrNull(readHeader(headers, "x-client-ip"), 64),
    64
  );

  const userAgent = trimOrNull(readHeader(headers, "user-agent"), 512);
  const browser = trimOrNull(detectBrowser(userAgent), 120);

  return { ipOrigem, userAgent, browser };
}

function normalizeAccessLogStatus(status: string | null | undefined): AccessLogStatus {
  return status === "FALHA" ? "FALHA" : "SUCESSO";
}

function normalizeAccessLogEmail(value: string | null | undefined): string {
  const email = String(value ?? "").trim().slice(0, 160);
  return email || FALLBACK_UNKNOWN_EMAIL;
}

export async function purgeExpiredAccessLogs(now = new Date()) {
  const cutoff = retentionCutoff(now);
  await db.delete(accessLogs).where(lt(accessLogs.createdAt, cutoff));
  return cutoff;
}

export async function recordLoginAttemptAccess(params: {
  userId?: number | null;
  userEmail?: string | null;
  status: AccessLogStatus;
  headers?: Record<string, unknown>;
}) {
  const cutoff = retentionCutoff();
  const meta = extractLoginRequestMeta(params.headers);
  const status = normalizeAccessLogStatus(params.status);

  await runDbTransaction(
    async (tx) => {
      await tx.delete(accessLogs).where(lt(accessLogs.createdAt, cutoff));
      await tx.insert(accessLogs).values({
        userId: typeof params.userId === "number" ? params.userId : null,
        userEmail: normalizeAccessLogEmail(params.userEmail),
        ipOrigem: meta.ipOrigem,
        userAgent: meta.userAgent,
        browser: meta.browser,
        status,
        createdAt: sql`now()`,
      });
    },
    { operation: "accessLogs.recordLoginAttemptAccess", mode: "allow-fallback" }
  );
}

export async function listRecentAccessLogs(limit = 200) {
  try {
    await purgeExpiredAccessLogs();
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, limit)) : 200;
    return await db
      .select({
        id: accessLogs.id,
        userId: accessLogs.userId,
        userNome: users.nome,
        userEmail: accessLogs.userEmail,
        ipOrigem: accessLogs.ipOrigem,
        browser: accessLogs.browser,
        status: accessLogs.status,
        userAgent: accessLogs.userAgent,
        createdAt: accessLogs.createdAt,
      })
      .from(accessLogs)
      .leftJoin(users, eq(users.id, accessLogs.userId))
      .orderBy(desc(accessLogs.createdAt))
      .limit(normalizedLimit);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "Falha ao carregar logs de acesso",
      500,
      "ACCESS_LOGS_ERROR"
    );
  }
}
