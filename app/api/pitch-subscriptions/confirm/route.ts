import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { subscriptionConfirmSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { confirmOwnerSubscriptionPayment } from "@/services/subscriptions";

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(subscriptionConfirmSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid subscription confirmation payload");
  }

  try {
    const result = await confirmOwnerSubscriptionPayment({
      txRef: parsed.data.txRef,
      ownerId: sessionCheck.user!.id,
    });
    revalidatePath("/host");
    revalidatePath("/create-events");
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error("Failed to confirm owner subscription payment", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
