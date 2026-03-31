import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { logger } from "@/lib/logger";

const ENCRYPTION_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const LOCAL_ENV_FILES = [".env.local", ".env"];

let cachedKey: Buffer | null = null;

function normalizeSecret(rawValue: string | null | undefined) {
  const value = rawValue?.trim() ?? "";
  if (!value) return null;

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const base64Buffer = Buffer.from(value, "base64");
    if (base64Buffer.byteLength === 32) {
      return base64Buffer;
    }
  } catch {}

  const utf8Buffer = Buffer.from(value, "utf8");
  if (utf8Buffer.byteLength === 32) {
    return utf8Buffer;
  }

  return null;
}

function readLocalEnvEncryptionKey() {
  for (const filename of LOCAL_ENV_FILES) {
    const filePath = path.join(process.cwd(), filename);
    if (!existsSync(filePath)) continue;

    const file = readFileSync(filePath, "utf8");
    for (const rawLine of file.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith("PAYOUT_ENCRYPTION_KEY=")) continue;
      const [, rawValue = ""] = line.split("=", 2);
      const normalized = rawValue.replace(/^['"]|['"]$/g, "");
      const key = normalizeSecret(normalized);
      if (key) return key;
    }
  }

  return null;
}

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const envKey = normalizeSecret(process.env.PAYOUT_ENCRYPTION_KEY);
  if (envKey) {
    cachedKey = envKey;
    return cachedKey;
  }

  if (process.env.NODE_ENV !== "production") {
    const localKey = readLocalEnvEncryptionKey();
    if (localKey) {
      logger.warn(
        "Using PAYOUT_ENCRYPTION_KEY from a local env file because the loaded environment value is invalid",
      );
      cachedKey = localKey;
      return cachedKey;
    }
  }

  throw new Error(
    "PAYOUT_ENCRYPTION_KEY must be configured as a 32-byte secret",
  );
}

export function encryptPayoutValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    authTag.toString("base64url"),
  ].join(":");
}

export function decryptPayoutValue(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith(`${ENCRYPTION_VERSION}:`)) {
    return value;
  }

  const [, ivPart, encryptedPart, authTagPart] = value.split(":");
  if (!ivPart || !encryptedPart || !authTagPart) {
    throw new Error("Invalid encrypted payout value");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");

  if (iv.byteLength !== IV_BYTES || authTag.byteLength !== AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted payout value");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

export function maskAccountNumber(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\s+/g, "");
  if (!digits) return null;
  const suffix = digits.slice(-4);
  return suffix ? `****${suffix}` : null;
}
