import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cacheTags } from "@/lib/cacheTags";

const getCachedCategories = unstable_cache(
  async () => prisma.category.findMany({ orderBy: { categoryName: "asc" } }),
  ["categories"],
  {
    revalidate: 60 * 60,
    tags: [cacheTags.categories],
  },
);

export async function getCategories() {
  return getCachedCategories();
}
