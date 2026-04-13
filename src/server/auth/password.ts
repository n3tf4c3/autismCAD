import crypto from "node:crypto";
import { compare, hash } from "bcryptjs";
import { env } from "@/lib/env";

const LEGACY_SHA_REGEX = /^[a-f0-9]{64}$/i;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, env.BCRYPT_COST);
}

function hashPasswordLegacy(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function isLegacyHash(passwordHash: string): boolean {
  return LEGACY_SHA_REGEX.test(passwordHash);
}

export function isLegacyPasswordHash(passwordHash: string): boolean {
  return isLegacyHash(passwordHash);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  if (!passwordHash) return false;
  if (isLegacyHash(passwordHash)) {
    const computed = Buffer.from(hashPasswordLegacy(password), "hex");
    const stored = Buffer.from(passwordHash, "hex");
    if (computed.length !== stored.length) return false;
    return crypto.timingSafeEqual(computed, stored);
  }
  return compare(password, passwordHash);
}
