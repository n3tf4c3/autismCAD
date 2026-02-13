import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

const globalR2 = globalThis as unknown as {
  r2Client?: S3Client;
};

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
    throw new Error(`R2 nao configurado: ${missing.join(", ")}`);
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
  const client = getR2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: params.key,
      ContentType: params.contentType,
    }),
    { expiresIn: params.expiresInSeconds ?? 300 }
  );
}
