import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { bookingConfirmSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { confirmBookingPayment } from "@/services/bookings";

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(bookingConfirmSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid booking confirmation payload");
  }

  try {
    const result = await confirmBookingPayment({
      txRef: parsed.data.txRef,
      actor: {
        userId: sessionCheck.user!.id,
        role: sessionCheck.user!.role ?? null,
        email: sessionCheck.user!.email ?? null,
        parentPitchOwnerUserId: sessionCheck.user!.parentPitchOwnerUserId ?? null,
      },
    });

    revalidatePath("/tickets");
    revalidatePath("/play");
    revalidatePath("/host");
    return NextResponse.json(result, { status: result.ok ? 200 : 202 });
  } catch (error) {
    logger.error("Failed to confirm booking payment", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
