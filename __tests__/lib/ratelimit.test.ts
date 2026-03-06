import { describe, it, expect } from "vitest";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";

describe("checkRateLimit", () => {
  it("allows the first request", () => {
    const result = checkRateLimit("test-key-allow-first", 5, 60_000);
    expect(result.limited).toBe(false);
  });

  it("allows requests up to the limit", () => {
    const key = `burst-key-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.limited).toBe(false);
    }
  });

  it("blocks requests exceeding the limit", () => {
    const key = `exceed-key-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("resets after the window expires", async () => {
    const key = `reset-key-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      checkRateLimit(key, 2, 100); // 100ms window
    }
    const blocked = checkRateLimit(key, 2, 100);
    expect(blocked.limited).toBe(true);

    await new Promise((r) => setTimeout(r, 150));
    const afterReset = checkRateLimit(key, 2, 100);
    expect(afterReset.limited).toBe(false);
  });

  it("treats different keys independently", () => {
    const ts = Date.now();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(`key-a-${ts}`, 5, 60_000);
    }
    const resultB = checkRateLimit(`key-b-${ts}`, 5, 60_000);
    expect(resultB.limited).toBe(false);
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
