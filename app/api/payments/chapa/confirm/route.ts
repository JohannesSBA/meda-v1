import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { confirmPaymentSchema } from "@/lib/validations/payments";
import {
  confirmChapaPayment,
  getPaymentEmailPayloadByReference,
} from "@/services/payments";
import { sendTicketConfirmationEmail } from "@/services/email";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { revalidateEventData } from "@/lib/revalidation";

export async function POST(request: Request) {
  const rl = await checkRateLimit(`confirm:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before confirming payment again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) {
    return session.response!;
  }

  const parsed = await parseJsonBody(confirmPaymentSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payment confirmation payload");
  }

  try {
    const result = await confirmChapaPayment({
      txRef: parsed.data.txRef,
      userId: session.user.id,
    });

    revalidateEventData(result.eventId, [session.user.id]);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.failureReason, status: result.status },
        { status: 409 },
      );
    }

    if (
      result.status === "fulfilled" &&
      result.quantity > 0 &&
      session.user.email
    ) {
      const emailPayload = await getPaymentEmailPayloadByReference(
        parsed.data.txRef,
        new URL(request.url).origin,
      );
      if (emailPayload) {
        try {
          await sendTicketConfirmationEmail({
            to: session.user.email,
            buyerName: session.user.name ?? null,
            eventName: emailPayload.eventName,
            eventDateTime: emailPayload.eventDateTime,
            eventEndTime: emailPayload.eventEndTime,
            locationLabel: emailPayload.locationLabel,
            quantity: emailPayload.quantity,
            eventId: emailPayload.eventId,
            attendeeIds: emailPayload.attendeeIds,
            baseUrl: emailPayload.baseUrl,
          });
        } catch (emailErr) {
          logger.error("Failed to send ticket confirmation email", emailErr);
        }
      }
    }

    return NextResponse.json(
      { quantity: result.quantity, status: result.status },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Chapa payment confirmation failed", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
