import { z } from "zod";

const e2eUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  image: z.string().url().optional(),
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
