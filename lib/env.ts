import { z } from "zod";

const e2eUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  image: z.string().url().optional(),
  parentPitchOwnerUserId: z.string().uuid().optional(),
});

export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://meda.app";
}

/**
 * Origin for Next.js `metadataBase` (favicon, OG, canonical). When
 * `NEXT_PUBLIC_BASE_URL` is unset in local dev, default to loopback + `PORT` so
 * `/logo-White.svg` resolves on the same host as the tab (not production).
 */
export function getMetadataBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT?.trim() || "3000";
    return `http://127.0.0.1:${port}`;
  }
  return getAppBaseUrl().replace(/\/$/, "");
}

/** Never true in production builds — see SECURITY_FINDINGS.md (E2E bypass). */
export function isE2EAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.E2E_AUTH_BYPASS === "1";
}

export function parseE2EUserCookie(value: string | undefined) {
  if (!value || !isE2EAuthBypassEnabled()) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    return e2eUserSchema.parse(parsed);
  } catch {
    return null;
  }
}
