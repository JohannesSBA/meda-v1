import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { confirmChapaPayment } from "@/services/payments";
import { confirmChapaEventCreationPayment } from "@/services/eventCreationFee";
import { confirmBookingPayment } from "@/services/bookings";
import { confirmPaymentPoolContribution } from "@/services/paymentPools";
import { confirmOwnerSubscriptionPayment } from "@/services/subscriptions";
import { logger } from "@/lib/logger";
import {
  chapaCallbackPayloadSchema,
  chapaCallbackQuerySchema,
} from "@/lib/validations/payments";
import {
  parseJsonBody,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { revalidateEventData } from "@/lib/revalidation";

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

async function reconcile(txRef: string) {
  if (txRef.startsWith("MEDAFEE")) {
    const result = await confirmChapaEventCreationPayment({ txRef });
    if (result.ok) {
      revalidateEventData(result.eventId);
    } else if (result.status === "failed") {
      logger.warn("Chapa callback failed to finalize event creation payment", {
        txRef,
        message: result.message,
      });
    }
    return result;
  }

  if (txRef.startsWith("MEDABOOK")) {
    const result = await confirmBookingPayment({ txRef });
    revalidatePath("/tickets");
    revalidatePath("/play");
    revalidatePath("/host");
    return result;
  }

  if (txRef.startsWith("MEDAPOOL")) {
    const result = await confirmPaymentPoolContribution({ txRef });
    revalidatePath("/tickets");
    revalidatePath("/host");
    return result;
  }

  if (txRef.startsWith("MEDASUB")) {
    const result = await confirmOwnerSubscriptionPayment({ txRef });
    revalidatePath("/host");
    revalidatePath("/create-events");
    return result;
  }

  const result = await confirmChapaPayment({ txRef });
  revalidateEventData(result.eventId);
  if (!result.ok && result.status === "requires_refund") {
    logger.warn("Chapa callback marked payment for refund review", {
      txRef,
      eventId: result.eventId,
      failureReason: result.failureReason,
    });
  }
  return result;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(chapaCallbackQuerySchema, url.searchParams);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid callback query");
  }

  const txRef =
    parsed.data.tx_ref ??
    parsed.data.txRef ??
    parsed.data.reference ??
    "";

  if (!txRef) {
    return NextResponse.json(
      { error: "Missing tx_ref" },
      { status: 400 },
    );
  }

  try {
    const result = await reconcile(txRef);
    return NextResponse.json(
      {
        ok: result.ok,
        status: result.status,
        eventId: "eventId" in result ? result.eventId : null,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Chapa callback reconciliation failed", error);
    return NextResponse.json(
      { error: "Callback reconciliation failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(chapaCallbackPayloadSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid callback payload");
  }
  const payload = parsed.data;
  const txRef = extractTxRefFromPayload(payload);

  if (!txRef) {
    return NextResponse.json(
      { error: "Missing tx_ref" },
      { status: 400 },
    );
  }

  try {
    const result = await reconcile(txRef);
    return NextResponse.json(
      {
        ok: result.ok,
        status: result.status,
        eventId: "eventId" in result ? result.eventId : null,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Chapa callback reconciliation failed", error);
    return NextResponse.json(
      { error: "Callback reconciliation failed" },
      { status: 500 },
    );
  }
}
