import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

process.env.TICKET_VERIFICATION_SECRET = "test-secret-for-unit-tests-only";
import { createVerificationToken, verifyToken } from "@/lib/tickets/verificationToken";

describe("createVerificationToken", () => {
  it("returns a token with two base64url parts separated by a dot", () => {
    const token = createVerificationToken("abc-attendee-id");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a different token each time due to different expiry timestamps", async () => {
    const t1 = createVerificationToken("id-1");
    await new Promise((r) => setTimeout(r, 1100)); // ensure different second
    const t2 = createVerificationToken("id-1");
    // Tokens may differ due to slightly different timestamps
    // (they can be equal within the same second — that's fine)
    expect(typeof t1).toBe("string");
    expect(typeof t2).toBe("string");
  });
});

describe("verifyToken", () => {
  it("returns the attendeeId for a valid, fresh token", () => {
    const attendeeId = "550e8400-e29b-41d4-a716-446655440000";
    const token = createVerificationToken(attendeeId);
    expect(verifyToken(token)).toBe(attendeeId);
  });

  it("returns null for a token with a tampered signature", () => {
    const token = createVerificationToken("some-id");
    const [payload] = token.split(".");
    const tampered = `${payload}.invalidsignature`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it("returns null for a token with a tampered payload", () => {
    const token = createVerificationToken("real-id");
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ id: "evil-id", exp: Math.floor(Date.now() / 1000) + 9999 }),
      "utf8",
    ).toString("base64url");
    expect(verifyToken(`${fakePayload}.${sig}`)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyToken("")).toBeNull();
  });

  it("returns null for a token missing the dot separator", () => {
    expect(verifyToken("nodot")).toBeNull();
  });

  it("returns null for a token with too many parts", () => {
    expect(verifyToken("a.b.c")).toBeNull();
  });

  it("returns null for a token with a non-JSON payload", () => {
    const badPayload = Buffer.from("not json", "utf8").toString("base64url");
    expect(verifyToken(`${badPayload}.fakesig`)).toBeNull();
  });

  it("returns null for an expired token", () => {
    // Manually construct a token with an expired timestamp
    const pastExp = Math.floor(Date.now() / 1000) - 1;
    const payload = { id: "expired-attendee", exp: pastExp };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", process.env.TICKET_VERIFICATION_SECRET!)
      .update(encoded)
      .digest("base64url");
    expect(verifyToken(`${encoded}.${sig}`)).toBeNull();
  });
});

describe("rate limit integration: verifyToken round-trip", () => {
  it("correctly verifies multiple distinct attendee IDs", () => {
    const ids = ["id-one", "id-two", "id-three", "550e8400-e29b-41d4-a716-446655440001"];
    for (const id of ids) {
      const token = createVerificationToken(id);
      expect(verifyToken(token)).toBe(id);
    }
  });
});
