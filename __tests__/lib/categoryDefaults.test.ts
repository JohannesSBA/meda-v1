import { beforeEach, describe, expect, it, vi } from "vitest";

describe("category fallback helpers", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns a provided category id even when the db mock does not expose category lookups", async () => {
    const { resolveCategoryIdWithFallback } = await import("@/lib/categoryDefaults");

    await expect(
      resolveCategoryIdWithFallback(
        "  category-123  ",
        {} as never,
      ),
    ).resolves.toBe("category-123");
  });

  it("uses the configured soccer category when it exists", async () => {
    process.env.SOCCER_CATEGORY_ID = "soccer-id";

    const db = {
      category: {
        findUnique: vi.fn().mockResolvedValue({ categoryId: "soccer-id" }),
        findFirst: vi.fn(),
      },
    };

    const { getSoccerCategoryId } = await import("@/lib/categoryDefaults");
    await expect(getSoccerCategoryId(db as never)).resolves.toBe("soccer-id");
    expect(db.category.findUnique).toHaveBeenCalled();
  });

  it("falls back to the named Soccer category when the configured id is missing", async () => {
    process.env.SOCCER_CATEGORY_ID = "missing-id";

    const db = {
      category: {
        findUnique: vi.fn().mockResolvedValueOnce(null),
        findFirst: vi.fn().mockResolvedValue({ categoryId: "soccer-by-name" }),
      },
    };

    const { getSoccerCategoryId } = await import("@/lib/categoryDefaults");
    await expect(getSoccerCategoryId(db as never)).resolves.toBe("soccer-by-name");
  });

  it("throws when a selected category does not exist", async () => {
    const db = {
      category: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn(),
      },
    };

    const { resolveCategoryIdWithFallback } = await import("@/lib/categoryDefaults");
    await expect(
      resolveCategoryIdWithFallback("selected-category", db as never),
    ).rejects.toThrow("Selected category does not exist");
  });

  it("throws when no soccer fallback can be resolved", async () => {
    delete process.env.SOCCER_CATEGORY_ID;

    const db = {
      category: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const { resolveCategoryIdWithFallback } = await import("@/lib/categoryDefaults");
    await expect(resolveCategoryIdWithFallback(null, db as never)).rejects.toThrow(
      "Default soccer category is not configured",
    );
  });
});
