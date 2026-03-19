/**
 * Rate limiter with optional Upstash REST support and in-memory fallback.
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are available,
 * the implementation attempts a lightweight REST-based increment/expiry flow.
 * When unavailable (or if requests fail), it falls back to in-memory limits.
 */

import { logger } from "./logger";

// ---------------------------------------------------------------------------
// In-memory fallback (single-process)
// ---------------------------------------------------------------------------

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

function pruneStore() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterMs: number };

function checkInMemory(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  if (Math.random() < 0.01) pruneStore();

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }

  return { limited: false };
}

// ---------------------------------------------------------------------------
// Optional Upstash REST-backed limiter
// ---------------------------------------------------------------------------

type UpstashClient = {
  url: string;
  token: string;
};

let upstashClient: UpstashClient | null = null;

function getUpstashClient(): UpstashClient | null {
  if (upstashClient) return upstashClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  upstashClient = { url, token };
  return upstashClient;
}

async function checkViaUpstashRest(
  client: UpstashClient,
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const safeWindowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const namespacedKey = `meda-rl:${key}`;
  const body = {
    // INCR key
    // EXPIRE key window_seconds NX
    // TTL key
    // Return [count, ttl]
    command: [
      "EVAL",
      "local count = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], ARGV[1], 'NX'); local ttl = redis.call('TTL', KEYS[1]); return {count, ttl}",
      "1",
      namespacedKey,
      String(safeWindowSeconds),
    ],
  };

  const response = await fetch(`${client.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([body]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit request failed (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  const first = Array.isArray(payload) ? payload[0] : null;
  const result =
    first && typeof first === "object" && "result" in first
      ? (first as { result?: unknown }).result
      : null;

  const count = Array.isArray(result) ? Number(result[0]) : Number.NaN;
  const ttlSeconds = Array.isArray(result) ? Number(result[1]) : Number.NaN;

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("Unexpected Upstash rate limit response");
  }

  if (count > maxRequests) {
    const retryAfterMs =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? Math.max(1, ttlSeconds * 1000)
        : windowMs;
    return { limited: true, retryAfterMs };
  }

  return { limited: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether `key` has exceeded `maxRequests` within `windowMs`.
 * Uses Upstash REST when configured, otherwise falls back to in-memory.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const client = getUpstashClient();
  if (client) {
    try {
      return await checkViaUpstashRest(client, key, maxRequests, windowMs);
    } catch (err) {
      logger.warn("Upstash rate limit check failed, falling back to in-memory", err);
    }
  }

  return checkInMemory(key, maxRequests, windowMs);
}

/**
 * Extracts the best available client identifier from a Request.
 * Prefers the `x-forwarded-for` header (set by Vercel/proxies).
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}
