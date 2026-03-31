import { createHmac } from "crypto";

const SECRET = (() => {
  const env = process.env.TICKET_VERIFICATION_SECRET;
  if (process.env.NODE_ENV === "production" && !env) {
    throw new Error("TICKET_VERIFICATION_SECRET is required in production");
  }
  return env ?? "meda-ticket-verify-default";
})();

const TOKEN_PREFIX = "bts_";

type BookingShareTokenPayload = {
  ticketId: string;
  purchaserId: string;
  exp: number;
};

export function isBookingTicketShareToken(token: string) {
  return token.startsWith(TOKEN_PREFIX);
}

export function createBookingTicketShareToken(args: {
  ticketId: string;
  purchaserId: string;
  expiresAt: Date;
}) {
  const payload: BookingShareTokenPayload = {
    ticketId: args.ticketId,
    purchaserId: args.purchaserId,
    exp: Math.floor(args.expiresAt.getTime() / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${TOKEN_PREFIX}${encoded}.${sig}`;
}

export function parseBookingTicketShareToken(token: string): BookingShareTokenPayload | null {
  if (!isBookingTicketShareToken(token)) return null;

  const raw = token.slice(TOKEN_PREFIX.length);
  const parts = raw.split(".");
  if (parts.length !== 2) return null;

  const [encoded, sigB64] = parts;
  const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  if (sigB64 !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as BookingShareTokenPayload;
    if (!payload.ticketId || !payload.purchaserId || typeof payload.exp !== "number") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
