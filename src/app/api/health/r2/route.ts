import { requireAdminGeral } from "@/server/auth/auth";
import { env } from "@/lib/env";
import { getR2Client } from "@/server/storage/r2";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

function assertConfigured() {
  const required = ["R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`R2 nao configurado: ${missing.join(", ")}`);
  }
}

export async function GET() {
  // Restrito: esse endpoint grava e apaga um objeto "smoke/*" no bucket.
  await requireAdminGeral();
  assertConfigured();

  const client = getR2Client();
  const bucket = env.R2_BUCKET!;
  const key = `smoke/vercel-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
  const body = `r2-smoke-${new Date().toISOString()}`;

  const putUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "text/plain" }),
    { expiresIn: 60 }
  );
  const putResp = await fetch(putUrl, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body,
  });
  if (!putResp.ok) {
    return Response.json(
      { ok: false, step: "put", status: putResp.status, statusText: putResp.statusText },
      { status: 502 }
    );
  }

  const getUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 }
  );
  const getResp = await fetch(getUrl);
  if (!getResp.ok) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => null);
    return Response.json(
      { ok: false, step: "get", status: getResp.status, statusText: getResp.statusText },
      { status: 502 }
    );
  }
  const text = await getResp.text();
  if (text !== body) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => null);
    return Response.json(
      { ok: false, step: "verify", error: "conteudo divergente" },
      { status: 502 }
    );
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return Response.json({ ok: true, bucket, key });
}

