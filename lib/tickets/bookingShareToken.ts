import { createHmac } from "crypto";

const SECRET = (() => {
  const env = process.env.TICKET_VERIFICATION_SECRET;
  if (process.env.NODE_ENV === "production" && !env) {
    throw new Error("TICKET_VERIFICATION_SECRET is required in production");
  }
  return env ?? "meda-ticket-verify-default";
})();

const TICKET_TOKEN_PREFIX = "bts_";
const POOL_TOKEN_PREFIX = "bps_";

type SignedBookingTokenPayload = {
  purchaserId: string;
  exp: number;
};

type BookingShareTokenPayload = SignedBookingTokenPayload & {
  ticketId: string;
};

export function isBookingTicketShareToken(token: string) {
  return token.startsWith(TICKET_TOKEN_PREFIX);
}

export type BookingPoolShareTokenPayload = SignedBookingTokenPayload & {
  bookingId: string;
};

export function isBookingPoolShareToken(token: string) {
  return token.startsWith(POOL_TOKEN_PREFIX);
}

function signBookingToken<T extends SignedBookingTokenPayload>(
  prefix: string,
  payload: T,
) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${prefix}${encoded}.${sig}`;
}

function parseSignedBookingToken<T extends SignedBookingTokenPayload>(
  token: string,
  prefix: string,
) {
  if (!token.startsWith(prefix)) return null;

  const raw = token.slice(prefix.length);
  const parts = raw.split(".");
  if (parts.length !== 2) return null;

  const [encoded, sigB64] = parts;
  const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  if (sigB64 !== expectedSig) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
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
  return signBookingToken(TICKET_TOKEN_PREFIX, payload);
}

export function createBookingPoolShareToken(args: {
  bookingId: string;
  purchaserId: string;
  expiresAt: Date;
}) {
  const payload: BookingPoolShareTokenPayload = {
    bookingId: args.bookingId,
    purchaserId: args.purchaserId,
    exp: Math.floor(args.expiresAt.getTime() / 1000),
  };
  return signBookingToken(POOL_TOKEN_PREFIX, payload);
}

export function parseBookingTicketShareToken(token: string): BookingShareTokenPayload | null {
  const payload = parseSignedBookingToken<BookingShareTokenPayload>(
    token,
    TICKET_TOKEN_PREFIX,
  );
  if (!payload) {
    return null;
  }

  if (!payload.ticketId || !payload.purchaserId || typeof payload.exp !== "number") {
    return null;
  }

  return payload;
}

export function parseBookingPoolShareToken(token: string): BookingPoolShareTokenPayload | null {
  const payload = parseSignedBookingToken<BookingPoolShareTokenPayload>(
    token,
    POOL_TOKEN_PREFIX,
  );
  if (!payload) {
    return null;
  }

  if (!payload.bookingId || !payload.purchaserId || typeof payload.exp !== "number") {
    return null;
  }

  return payload;
}
