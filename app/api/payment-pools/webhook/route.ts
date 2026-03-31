import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  parseJsonText,
  validationErrorResponse,
} from "@/lib/validations/http";
import { chapaCallbackPayloadSchema } from "@/lib/validations/payments";
import { confirmPaymentPoolContribution } from "@/services/paymentPools";

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

export async function POST(request: Request) {
  const rawBody = await request.text();
  const parsed = parseJsonText(chapaCallbackPayloadSchema, rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid webhook payload");
  }

  const txRef = extractTxRefFromPayload(parsed.data);
  if (!txRef || !txRef.startsWith("MEDAPOOL")) {
    return NextResponse.json({ error: "Missing pool tx_ref" }, { status: 400 });
  }

  try {
    const result = await confirmPaymentPoolContribution({ txRef });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error("Pool webhook reconciliation failed", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}
