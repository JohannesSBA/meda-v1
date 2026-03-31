import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  poolIdParamSchema,
  poolContributeSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { contributeToPaymentPool } from "@/services/paymentPools";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(poolIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid payment pool id");
  }
  const parsedBody = await parseJsonBody(poolContributeSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid contribution payload");
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await contributeToPaymentPool({
      poolId: parsedParams.data.id,
      amount: parsedBody.data.amount,
      paymentMethod: parsedBody.data.paymentMethod,
      actor: {
        userId: sessionCheck.user!.id,
        role: sessionCheck.user!.role ?? null,
        email: sessionCheck.user!.email ?? null,
        parentPitchOwnerUserId: sessionCheck.user!.parentPitchOwnerUserId ?? null,
      },
      callbackUrl: `${origin}/api/payments/chapa/callback`,
      returnUrlBase: `${origin}/tickets`,
    });

    revalidatePath("/tickets");
    revalidatePath("/host");
    return NextResponse.json(result, { status: result.checkoutUrl ? 201 : 200 });
  } catch (error) {
    logger.error("Failed to contribute to payment pool", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
