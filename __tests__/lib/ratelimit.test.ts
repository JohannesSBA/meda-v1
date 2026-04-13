import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  checkOwnerDashboardCsvExportRateLimit,
  checkOwnerPayoutInitRateLimit,
  checkRateLimit,
  getClientId,
} from "@/lib/ratelimit";

describe("checkRateLimit", () => {
  it("allows the first request", async () => {
    const result = await checkRateLimit("test-key-allow-first", 5, 60_000);
    expect(result.limited).toBe(false);
  });

  it("allows requests up to the limit", async () => {
    const key = `burst-key-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(key, 5, 60_000);
      expect(result.limited).toBe(false);
    }
  });

  it("blocks requests exceeding the limit", async () => {
    const key = `exceed-key-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60_000);
    }
    const result = await checkRateLimit(key, 5, 60_000);
    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("resets after the window expires", async () => {
    const key = `reset-key-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(key, 2, 100);
    }
    const blocked = await checkRateLimit(key, 2, 100);
    expect(blocked.limited).toBe(true);

    await new Promise((r) => setTimeout(r, 150));
    const afterReset = await checkRateLimit(key, 2, 100);
    expect(afterReset.limited).toBe(false);
  });

  it("treats different keys independently", async () => {
    const ts = Date.now();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(`key-a-${ts}`, 5, 60_000);
    }
    const resultB = await checkRateLimit(`key-b-${ts}`, 5, 60_000);
    expect(resultB.limited).toBe(false);
  });
});

describe("checkOwnerDashboardCsvExportRateLimit", () => {
  it("allows 15 owner CSV exports per minute then blocks the 16th", async () => {
    const ownerId = randomUUID();
    for (let i = 0; i < 15; i++) {
      const r = await checkOwnerDashboardCsvExportRateLimit(ownerId);
      expect(r.limited).toBe(false);
    }
    const blocked = await checkOwnerDashboardCsvExportRateLimit(ownerId);
    expect(blocked.limited).toBe(true);
    if (blocked.limited) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("uses independent buckets for different owner ids", async () => {
    const ownerA = randomUUID();
    const ownerB = randomUUID();
    for (let i = 0; i < 15; i++) {
      await checkOwnerDashboardCsvExportRateLimit(ownerA);
    }
    expect((await checkOwnerDashboardCsvExportRateLimit(ownerB)).limited).toBe(false);
  });
});

describe("checkOwnerPayoutInitRateLimit", () => {
  it("allows 5 payout init attempts per minute then blocks the 6th", async () => {
    const ownerId = randomUUID();
    for (let i = 0; i < 5; i++) {
      expect((await checkOwnerPayoutInitRateLimit(ownerId)).limited).toBe(false);
    }
    const blocked = await checkOwnerPayoutInitRateLimit(ownerId);
    expect(blocked.limited).toBe(true);
    if (blocked.limited) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("scopes payout init limits per owner independently", async () => {
    const ownerA = randomUUID();
    const ownerB = randomUUID();
    for (let i = 0; i < 5; i++) {
      await checkOwnerPayoutInitRateLimit(ownerA);
    }
    expect((await checkOwnerPayoutInitRateLimit(ownerB)).limited).toBe(false);
  });
});

describe("getClientId", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(getClientId(req)).toBe("203.0.113.1");
  });

  it("returns 'unknown' when no forwarded header is present", () => {
    const req = new Request("http://localhost/");
    expect(getClientId(req)).toBe("unknown");
  });
});
