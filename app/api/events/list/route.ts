import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const events = await prisma.event.findMany({
    include: {
      category: true,
    },
  });
  return NextResponse.json({ items: events }, { status: 200 });
}