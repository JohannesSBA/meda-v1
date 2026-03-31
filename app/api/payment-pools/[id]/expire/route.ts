import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { expirePaymentPools } from "@/services/paymentPools";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    try {
      const result = await expirePaymentPools();
      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      logger.error("Failed to expire payment pools", error);
      return NextResponse.json(
        { error: formatUnknownError(error) },
        { status: 500 },
      );
    }
  }

  const sessionCheck = await requireAdminUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const result = await expirePaymentPools();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error("Failed to expire payment pools", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}
