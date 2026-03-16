import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  promoCodeFindManyMock,
  promoCodeFindUniqueMock,
  promoCodeUpdateMock,
} = vi.hoisted(() => ({
  promoCodeFindManyMock: vi.fn(),
  promoCodeFindUniqueMock: vi.fn(),
  promoCodeUpdateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    promoCode: {
      findMany: promoCodeFindManyMock,
      findUnique: promoCodeFindUniqueMock,
      update: promoCodeUpdateMock,
    },
  },
}));

describe("promo code service", () => {
  beforeEach(() => {
    promoCodeFindManyMock.mockReset();
    promoCodeFindUniqueMock.mockReset();
    promoCodeUpdateMock.mockReset();
  });

  it("prefers a pitch-owner scoped promo over a global one", async () => {
    promoCodeFindManyMock.mockResolvedValue([
      {
        id: "global",
        code: "FREE100",
        discountType: "full",
        discountValue: 100,
        pitchOwnerUserId: null,
        maxUses: null,
        usedCount: 0,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "scoped",
        code: "FREE100",
        discountType: "full",
        discountValue: 100,
        pitchOwnerUserId: "owner-1",
        maxUses: null,
        usedCount: 0,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        isActive: true,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);

    const { findActivePromoCode } = await import("@/services/promoCode");
    const promo = await findActivePromoCode(
      {
        promoCode: {
          findMany: promoCodeFindManyMock,
        },
      } as never,
      { code: "free100", pitchOwnerUserId: "owner-1" },
    );

    expect(promo?.id).toBe("scoped");
  });

  it("increments promo usage when consumed", async () => {
    promoCodeFindUniqueMock.mockResolvedValue({
      id: "promo-1",
      isActive: true,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      maxUses: 3,
      usedCount: 1,
    });

    const { consumePromoCode } = await import("@/services/promoCode");
    await consumePromoCode(
      {
        promoCode: {
          findUnique: promoCodeFindUniqueMock,
          update: promoCodeUpdateMock,
        },
      } as never,
      "promo-1",
    );

    expect(promoCodeUpdateMock).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: {
        usedCount: { increment: 1 },
      },
    });
  });
});
