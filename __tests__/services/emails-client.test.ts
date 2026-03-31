import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const warnMock = vi.fn();
const ResendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: ResendMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: warnMock,
  },
}));

const ORIGINAL_ENV = { ...process.env };

describe("email client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses the configured from address", async () => {
    process.env.EMAIL_FROM = "Meda <hello@meda.app>";
    process.env.RESEND_API_KEY = "re_test_key";

    const mod = await import("@/services/emails/client");

    expect(mod.FROM_ADDRESS).toBe("Meda <hello@meda.app>");
    mod.getResend();
    expect(ResendMock).toHaveBeenCalledWith("re_test_key");
  });

  it("falls back to the resend sandbox in non-production", async () => {
    delete process.env.EMAIL_FROM;
    process.env.RESEND_API_KEY = "re_test_key";
    Object.assign(process.env, { NODE_ENV: "test" });

    const mod = await import("@/services/emails/client");

    expect(mod.FROM_ADDRESS).toBe("Meda <onboarding@resend.dev>");
    expect(warnMock).toHaveBeenCalled();
  });

  it("throws when EMAIL_FROM is missing in production", async () => {
    delete process.env.EMAIL_FROM;
    Object.assign(process.env, { NODE_ENV: "production" });

    await expect(import("@/services/emails/client")).rejects.toThrow(
      "EMAIL_FROM is required in production",
    );
  });

  it("throws when the resend api key is missing", async () => {
    process.env.EMAIL_FROM = "Meda <hello@meda.app>";
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND;

    const mod = await import("@/services/emails/client");
    expect(() => mod.getResend()).toThrow("RESEND_API_KEY or RESEND must be set");
  });
});
