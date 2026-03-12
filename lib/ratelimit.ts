/**
 * Rate limiter with Upstash Redis support and in-memory fallback.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
 * rate limiting is backed by Upstash Redis for multi-instance deployments.
 * Otherwise, falls back to a per-process in-memory sliding window.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
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
// Upstash Redis-backed rate limiter
// ---------------------------------------------------------------------------

let upstashLimiter: Ratelimit | null = null;

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const redis = new Redis({ url, token });
    upstashLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "meda-rl",
    });
    return upstashLimiter;
  } catch (err) {
    logger.warn("Failed to initialize Upstash rate limiter, falling back to in-memory", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether `key` has exceeded `maxRequests` within `windowMs`.
 * Uses Upstash Redis when configured, otherwise falls back to in-memory.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter();
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      if (!result.success) {
        return { limited: true, retryAfterMs: result.reset - Date.now() };
      }
      return { limited: false };
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
