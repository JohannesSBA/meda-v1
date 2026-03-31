import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("env helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("reads required env vars and app base url", async () => {
    process.env.REQUIRED_KEY = "  value  ";
    process.env.NEXT_PUBLIC_BASE_URL = "https://meda.test";

    const { getAppBaseUrl, getRequiredEnv } = await import("@/lib/env");

    expect(getRequiredEnv("REQUIRED_KEY")).toBe("value");
    expect(getAppBaseUrl()).toBe("https://meda.test");
  });

  it("throws when a required env var is missing and falls back to the default base url", async () => {
    delete process.env.REQUIRED_KEY;
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const { getAppBaseUrl, getRequiredEnv } = await import("@/lib/env");

    expect(() => getRequiredEnv("REQUIRED_KEY")).toThrow(
      "REQUIRED_KEY is not configured",
    );
    expect(getAppBaseUrl()).toBe("https://meda.app");
  });

  it("enables E2E auth bypass only in non-production mode", async () => {
    Object.assign(process.env, { NODE_ENV: "test", E2E_AUTH_BYPASS: "1" });

    let mod = await import("@/lib/env");
    expect(mod.isE2EAuthBypassEnabled()).toBe(true);

    vi.resetModules();
    Object.assign(process.env, { NODE_ENV: "production", E2E_AUTH_BYPASS: "1" });
    mod = await import("@/lib/env");
    expect(mod.isE2EAuthBypassEnabled()).toBe(false);
  });

  it("parses and validates the E2E bypass cookie payload", async () => {
    Object.assign(process.env, { NODE_ENV: "test", E2E_AUTH_BYPASS: "1" });

    const { parseE2EUserCookie } = await import("@/lib/env");
    const encoded = Buffer.from(
      JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440010",
        email: "e2e@example.com",
        name: "E2E User",
        role: "user",
      }),
      "utf8",
    ).toString("base64url");

    expect(parseE2EUserCookie(encoded)).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440010",
      email: "e2e@example.com",
      name: "E2E User",
      role: "user",
    });
    expect(parseE2EUserCookie("bad-token")).toBeNull();
  });

  it("returns null when the E2E bypass is disabled", async () => {
    Object.assign(process.env, { NODE_ENV: "production", E2E_AUTH_BYPASS: "0" });

    const { parseE2EUserCookie } = await import("@/lib/env");
    const encoded = Buffer.from(
      JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440010",
      }),
      "utf8",
    ).toString("base64url");

    expect(parseE2EUserCookie(encoded)).toBeNull();
  });
});
