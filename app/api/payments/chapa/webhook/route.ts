import { createHmac, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { confirmChapaPayment } from "@/services/payments";
import { confirmChapaEventCreationPayment } from "@/services/eventCreationFee";
import { confirmBookingPayment } from "@/services/bookings";
import { confirmPaymentPoolContribution } from "@/services/paymentPools";
import { confirmOwnerSubscriptionPayment } from "@/services/subscriptions";
import { revalidateEventData } from "@/lib/revalidation";
import { chapaCallbackPayloadSchema } from "@/lib/validations/payments";
import {
  parseJsonText,
  validationErrorResponse,
} from "@/lib/validations/http";

function extractTxRefFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;

  const txRef =
    record.tx_ref ??
    record.txRef ??
    record.reference ??
    data?.tx_ref ??
    data?.txRef ??
    data?.reference;

  return typeof txRef === "string" && txRef.trim() ? txRef.trim() : null;
}

function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-chapa-signature") ??
    request.headers.get("chapa-signature") ??
    "";
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET ?? "";

  if (!webhookSecret && process.env.NODE_ENV === "production") {
    logger.error("CHAPA_WEBHOOK_SECRET is missing in production");
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 503 },
    );
  }

  if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  try {
    const parsed = parseJsonText(chapaCallbackPayloadSchema, rawBody);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Invalid webhook payload");
    }

    const txRef = extractTxRefFromPayload(parsed.data);
    if (!txRef) {
      return NextResponse.json(
        { error: "Missing tx_ref" },
        { status: 400 },
      );
    }

    if (txRef.startsWith("MEDAFEE")) {
      const result = await confirmChapaEventCreationPayment({ txRef });
      if (result.ok) {
        revalidateEventData(result.eventId);
      } else if (result.status === "failed") {
        logger.warn("Chapa webhook failed to finalize event creation payment", {
          txRef,
          message: result.message,
        });
      }
      return NextResponse.json(
        {
          ok: result.ok,
          status: result.status,
          eventId: result.ok ? result.eventId : null,
        },
        { status: 200 },
      );
    }

    if (txRef.startsWith("MEDABOOK")) {
      const result = await confirmBookingPayment({ txRef });
      revalidatePath("/tickets");
      revalidatePath("/play");
      revalidatePath("/host");
      return NextResponse.json(result, { status: 200 });
    }

    if (txRef.startsWith("MEDAPOOL")) {
      const result = await confirmPaymentPoolContribution({ txRef });
      revalidatePath("/tickets");
      revalidatePath("/host");
      return NextResponse.json(result, { status: 200 });
    }

    if (txRef.startsWith("MEDASUB")) {
      const result = await confirmOwnerSubscriptionPayment({ txRef });
      revalidatePath("/host");
      revalidatePath("/create-events");
      return NextResponse.json(result, { status: 200 });
    }

    const result = await confirmChapaPayment({ txRef });
    revalidateEventData(result.eventId);
    if (!result.ok && result.status === "requires_refund") {
      logger.warn("Chapa webhook marked payment for refund review", {
        txRef,
        eventId: result.eventId,
        failureReason: result.failureReason,
      });
    }
    return NextResponse.json(
      {
        ok: result.ok,
        status: result.status,
        eventId: result.eventId,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    logger.error("Chapa webhook reconciliation failed", error);
    return NextResponse.json(
      { error: "Webhook reconciliation failed" },
      { status: 500 },
    );
  }
}
