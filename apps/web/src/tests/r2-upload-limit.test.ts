import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_UPLOAD_BYTES, isValidUploadSize } from "@/lib/uploads/upload-limits";
import { createBoundedUploadCommand } from "@/server/storage/r2-upload-command";

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function source(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), "utf8");
}

test("contrato de upload aceita somente tamanho positivo ate 20 MB", () => {
  assert.equal(isValidUploadSize(1), true);
  assert.equal(isValidUploadSize(MAX_UPLOAD_BYTES), true);
  assert.equal(isValidUploadSize(0), false);
  assert.equal(isValidUploadSize(MAX_UPLOAD_BYTES + 1), false);
  assert.equal(isValidUploadSize(1.5), false);
});

test("comando PUT carrega o tamanho exato validado", () => {
  const command = createBoundedUploadCommand({
    bucket: "bucket",
    key: "pacientes/temp/1/foto/teste.png",
    contentType: "image/png",
    contentLength: 123,
  });

  assert.equal(command.input.ContentLength, 123);
  assert.throws(
    () =>
      createBoundedUploadCommand({
        bucket: "bucket",
        key: "key",
        contentType: "image/png",
        contentLength: MAX_UPLOAD_BYTES + 1,
      }),
    /entre 1 byte e 20 MB/
  );
});

test("URL pre-assinada inclui content-length nos headers cobertos pela assinatura", async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://example.r2.cloudflarestorage.com",
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const command = createBoundedUploadCommand({
    bucket: "bucket",
    key: "key",
    contentType: "application/pdf",
    contentLength: 123,
  });

  const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const signedHeaders = new URL(signedUrl).searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];

  assert.ok(signedHeaders.includes("content-length"));
  assert.ok(signedHeaders.includes("host"));
  client.destroy();
});

test("actions e clientes propagam o tamanho real ate o comando assinado", () => {
  const action = source("app/(protected)/pacientes/paciente.actions.ts");
  const storage = source("server/storage/r2.ts");
  const clients = [
    source("app/(protected)/pacientes/paciente-form.client.tsx"),
    source("app/(protected)/pacientes/[id]/arquivos.client.tsx"),
  ];

  assert.match(action, /size:\s*z\.number\(\)\.int\(\)\.min\(1\)\.max\(MAX_UPLOAD_BYTES\)/);
  assert.match(action, /contentLength:\s*parsed\.size/);
  assert.match(storage, /createBoundedUploadCommand\(\{/);
  assert.match(storage, /contentLength:\s*params\.contentLength/);
  for (const client of clients) {
    assert.match(client, /isValidUploadSize\(file\.size\)/);
    assert.match(client, /size:\s*file\.size/);
  }
});
