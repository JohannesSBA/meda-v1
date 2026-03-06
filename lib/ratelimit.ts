/**
 * Simple sliding-window in-memory rate limiter.
 *
 * Effective per-process. On Vercel/serverless with multiple instances each
 * instance maintains its own window, which still provides meaningful protection
 * against single-client abuse within a request burst.
 *
 * For production multi-instance deployments, replace the store with a Redis/
 * Upstash-backed implementation using @upstash/ratelimit.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Prune stale entries to prevent unbounded memory growth
function pruneStore() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterMs: number };

/**
 * Check whether `key` has exceeded `maxRequests` within `windowMs`.
 *
 * @param key       - Unique identifier for the client/action (e.g. IP + route).
 * @param maxRequests - Maximum allowed requests per window.
 * @param windowMs  - Window duration in milliseconds.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup (every ~100 checks)
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

/**
 * Extracts the best available client identifier from a Request.
 * Prefers the `x-forwarded-for` header (set by Vercel/proxies).
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}
