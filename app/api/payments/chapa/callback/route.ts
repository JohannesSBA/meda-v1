import { NextResponse } from "next/server";
import { confirmChapaPayment } from "@/services/payments";
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
  const result = await confirmChapaPayment({ txRef });
  revalidateEventData(result.eventId);
  if (!result.ok) {
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
      { ok: result.ok, status: result.status, eventId: result.eventId },
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
      { ok: result.ok, status: result.status, eventId: result.eventId },
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
