import { beforeEach, describe, expect, it, vi } from "vitest";

describe("payout encryption helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PAYOUT_ENCRYPTION_KEY = "11".repeat(32);
  });

  it("round-trips encrypted payout values", async () => {
    const { encryptPayoutValue, decryptPayoutValue, maskAccountNumber } =
      await import("@/lib/encryption");

    const encrypted = encryptPayoutValue("0123456789");

    expect(encrypted).toMatch(/^v1:/);
    expect(decryptPayoutValue(encrypted)).toBe("0123456789");
    expect(maskAccountNumber("0123456789")).toBe("****6789");
  });
});
