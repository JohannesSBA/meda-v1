import { prisma } from "@/lib/prisma";
import { DEFAULT_SOCCER_CATEGORY_ID } from "@/lib/constants";

type CategoryLookupClient = {
  category?: {
    findUnique?: (args: {
      where: { categoryId: string };
      select: { categoryId: true };
    }) => Promise<{ categoryId: string } | null>;
    findFirst?: (args: {
      where: {
        categoryName: {
          equals: string;
          mode: "insensitive";
        };
      };
      select: { categoryId: true };
      orderBy: { categoryName: "asc" };
    }) => Promise<{ categoryId: string } | null>;
  };
};

function normalizeCategoryId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getSoccerCategoryId(db: CategoryLookupClient = prisma) {
  const configuredId = normalizeCategoryId(
    process.env.SOCCER_CATEGORY_ID ?? DEFAULT_SOCCER_CATEGORY_ID,
  );

  if (!db.category?.findUnique || !db.category?.findFirst) {
    if (configuredId) {
      return configuredId;
    }
    throw new Error("Default soccer category is not configured");
  }

  if (configuredId) {
    const configuredCategory = await db.category.findUnique({
      where: { categoryId: configuredId },
      select: { categoryId: true },
    });
    if (configuredCategory) {
      return configuredCategory.categoryId;
    }
  }

  const namedCategory = await db.category.findFirst({
    where: {
      categoryName: {
        equals: "Soccer",
        mode: "insensitive",
      },
    },
    select: { categoryId: true },
    orderBy: { categoryName: "asc" },
  });

  if (namedCategory) {
    return namedCategory.categoryId;
  }

  throw new Error("Default soccer category is not configured");
}

export async function resolveCategoryIdWithFallback(
  categoryId: string | null | undefined,
  db: CategoryLookupClient = prisma,
) {
  const normalized = normalizeCategoryId(categoryId);
  const resolvedCategoryId = normalized ?? (await getSoccerCategoryId(db));
  if (!db.category?.findUnique) {
    return resolvedCategoryId;
  }
  const category = await db.category.findUnique({
    where: { categoryId: resolvedCategoryId },
    select: { categoryId: true },
  });

  if (!category) {
    throw new Error(
      normalized ? "Selected category does not exist" : "Default soccer category is not configured",
    );
  }

  return category.categoryId;
}
