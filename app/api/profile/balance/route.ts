import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";

export async function GET() {
  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const record = await prisma.userBalance.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(
    { balanceEtb: record ? Number(record.balanceEtb) : 0 },
    { status: 200 },
  );
}
