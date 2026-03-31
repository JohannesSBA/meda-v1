import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { poolIdParamSchema } from "@/lib/validations/bookingInventory";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { getPaymentPoolForUser } from "@/services/paymentPools";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = parseParams(poolIdParamSchema, await context.params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payment pool id");
  }

  try {
    const paymentPool = await getPaymentPoolForUser({
      poolId: parsed.data.id,
      actor: {
        userId: sessionCheck.user!.id,
        role: sessionCheck.user!.role ?? null,
        email: sessionCheck.user!.email ?? null,
        parentPitchOwnerUserId: sessionCheck.user!.parentPitchOwnerUserId ?? null,
      },
    });
    return NextResponse.json({ paymentPool }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load payment pool", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 404 },
    );
  }
}
