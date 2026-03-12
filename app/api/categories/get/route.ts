import { NextResponse } from "next/server";
import { getCategories } from "@/lib/data/categories";

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(
    { categories },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
