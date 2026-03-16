import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { listChapaBanks } from "@/lib/chapa";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export async function GET() {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const banks = await listChapaBanks();
    return NextResponse.json({ banks }, { status: 200 });
  } catch (error) {
    logger.error("Failed to fetch Chapa banks", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 503 },
    );
  }
}
