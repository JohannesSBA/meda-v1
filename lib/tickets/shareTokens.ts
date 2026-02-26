import { createHash, randomBytes } from "crypto";

export function generateShareToken() {
  return randomBytes(24).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
