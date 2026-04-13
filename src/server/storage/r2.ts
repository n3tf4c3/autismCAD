import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/server/shared/errors";

const globalR2 = globalThis as unknown as {
  r2Client?: S3Client;
};

export const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function normalizeUploadContentType(contentType: string): string {
  return String(contentType || "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
}

export function isAllowedUploadContentType(contentType: string): boolean {
  const normalized = normalizeUploadContentType(contentType);
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(normalized);
}

function resolveEndpoint(): string {
  if (env.R2_ENDPOINT) {
    // Some dashboards show "S3 API" including "/<bucket>" path. For S3Client,
    // use the account endpoint base and let the SDK add the bucket.
    try {
      const url = new URL(env.R2_ENDPOINT);
      const bucket = env.R2_BUCKET ? `/${env.R2_BUCKET}` : null;
      if (bucket && (url.pathname === bucket || url.pathname === `${bucket}/`)) {
        return url.origin;
      }
      return env.R2_ENDPOINT;
    } catch {
      return env.R2_ENDPOINT;
    }
  }
  if (!env.R2_ACCOUNT_ID) {
    throw new Error("R2_ACCOUNT_ID ou R2_ENDPOINT deve ser configurado.");
  }
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function assertR2Config() {
  const required = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new AppError(`R2 nao configurado: ${missing.join(", ")}`, 500, "R2_NOT_CONFIGURED");
  }
}

export function getR2Client(): S3Client {
  assertR2Config();
  if (globalR2.r2Client) return globalR2.r2Client;

  globalR2.r2Client = new S3Client({
    region: env.R2_REGION,
    endpoint: resolveEndpoint(),
    forcePathStyle: true, // Cloudflare R2 works reliably with path-style URLs.
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });

  return globalR2.r2Client;
}

export function buildObjectKey(prefix: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}/${randomUUID()}-${safeName}`;
}

export async function uploadBufferToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

export async function deleteObjectFromR2(key: string) {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
    })
  );
}

export type R2ObjectSummary = {
  key: string;
  lastModified: Date | null;
  size: number;
};

export async function listObjectsInR2(params: {
  prefix: string;
  maxKeys?: number;
  continuationToken?: string;
}): Promise<{
  items: R2ObjectSummary[];
  nextContinuationToken: string | null;
}> {
  const client = getR2Client();
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: env.R2_BUCKET!,
      Prefix: params.prefix,
      MaxKeys: params.maxKeys ?? 1000,
      ContinuationToken: params.continuationToken,
    })
  );

  return {
    items: (result.Contents ?? [])
      .map((item) => ({
        key: String(item.Key || "").trim(),
        lastModified: item.LastModified ?? null,
        size: Number(item.Size ?? 0),
      }))
      .filter((item) => Boolean(item.key)),
    nextContinuationToken: result.NextContinuationToken ?? null,
  };
}

export async function deleteObjectsFromR2(keys: string[]): Promise<number> {
  const normalizedKeys = Array.from(
    new Set(keys.map((key) => String(key || "").trim()).filter(Boolean))
  );
  if (!normalizedKeys.length) return 0;

  const client = getR2Client();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: env.R2_BUCKET!,
      Delete: {
        Objects: normalizedKeys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    })
  );
  return normalizedKeys.length;
}

export async function cleanupTempObjectsInR2(params?: {
  prefix?: string;
  retentionHours?: number;
  batchSize?: number;
}): Promise<{
  prefix: string;
  retentionHours: number;
  scanned: number;
  deleted: number;
  kept: number;
}> {
  const prefix = String(params?.prefix || "pacientes/temp/").trim();
  const retentionHours = params?.retentionHours ?? env.R2_TEMP_UPLOAD_RETENTION_HOURS;
  const batchSize = params?.batchSize ?? env.R2_TEMP_UPLOAD_CLEANUP_BATCH_SIZE;
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;

  let continuationToken: string | null = null;
  let scanned = 0;
  let deleted = 0;
  let kept = 0;

  do {
    const page = await listObjectsInR2({
      prefix,
      maxKeys: Math.min(batchSize, 1000),
      continuationToken: continuationToken ?? undefined,
    });
    continuationToken = page.nextContinuationToken;
    scanned += page.items.length;

    const expiredKeys = page.items
      .filter((item) => {
        const lastModified = item.lastModified?.getTime();
        return Number.isFinite(lastModified) && Number(lastModified) <= cutoff;
      })
      .map((item) => item.key);

    kept += page.items.length - expiredKeys.length;
    deleted += await deleteObjectsFromR2(expiredKeys);
  } while (continuationToken);

  return { prefix, retentionHours, scanned, deleted, kept };
}

function encodeCopySourceKey(key: string): string {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function copyObjectInR2(params: {
  sourceKey: string;
  destinationKey: string;
}) {
  const client = getR2Client();
  const source = `${env.R2_BUCKET!}/${encodeCopySourceKey(params.sourceKey)}`;
  await client.send(
    new CopyObjectCommand({
      Bucket: env.R2_BUCKET!,
      CopySource: source,
      Key: params.destinationKey,
      MetadataDirective: "COPY",
    })
  );
}

function isNotFoundR2Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const status = candidate.$metadata?.httpStatusCode;
  const code = String(candidate.name ?? candidate.Code ?? candidate.code ?? "");
  return status === 404 || code === "NotFound" || code === "NoSuchKey";
}

export async function objectExistsInR2(key: string): Promise<boolean> {
  const client = getR2Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: env.R2_BUCKET!,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if (isNotFoundR2Error(error)) return false;
    throw error;
  }
}

export async function createSignedReadUrl(key: string, expiresInSeconds = 300) {
  const client = getR2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function createSignedWriteUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const normalizedContentType = normalizeUploadContentType(params.contentType);
  if (!isAllowedUploadContentType(normalizedContentType)) {
    throw new AppError("Tipo de arquivo nao permitido", 400, "INVALID_CONTENT_TYPE");
  }
  const client = getR2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: params.key,
      ContentType: normalizedContentType,
    }),
    { expiresIn: params.expiresInSeconds ?? 300 }
  );
}
