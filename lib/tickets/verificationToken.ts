/**
 * Ticket verification tokens -- HMAC-signed tokens for ticket verification.
 */

import { createHmac } from "crypto";

const SECRET = (() => {
  const env = process.env.TICKET_VERIFICATION_SECRET;
  if (process.env.NODE_ENV === "production" && !env) {
    throw new Error("TICKET_VERIFICATION_SECRET is required in production");
  }
  return env ?? "meda-ticket-verify-default";
})();

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days

type TokenPayload = {
  id: string;
  exp: number;
};

export function createVerificationToken(attendeeId: string): string {
  const payload: TokenPayload = {
    id: attendeeId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sigB64] = parts;

  const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  if (sigB64 !== expectedSig) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }

  if (!payload.id || typeof payload.exp !== "number") return null;
  if (Math.floor(Date.now() / 1000) > payload.exp) return null;

  return payload.id;
}
