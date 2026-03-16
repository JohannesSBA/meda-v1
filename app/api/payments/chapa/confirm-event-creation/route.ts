import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { confirmPaymentSchema } from "@/lib/validations/payments";
import {
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/validations/http";
import { revalidateEventData } from "@/lib/revalidation";
import { confirmChapaEventCreationPayment } from "@/services/eventCreationFee";

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(confirmPaymentSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(
      parsed.error,
      "Invalid event creation payment confirmation payload",
    );
  }

  try {
    const result = await confirmChapaEventCreationPayment({
      txRef: parsed.data.txRef,
      pitchOwnerUserId: sessionCheck.user!.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, status: result.status },
        { status: 409 },
      );
    }

    revalidateEventData(result.eventId, [sessionCheck.user!.id]);
    revalidatePath("/create-events");

    return NextResponse.json(
      {
        eventId: result.eventId,
        createdOccurrences: result.createdOccurrences,
        status: result.status,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Event creation payment confirmation failed", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
