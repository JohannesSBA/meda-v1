import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
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
import { reconcilePitchOwnerPayout } from "@/services/payouts";

function extractReference(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;

  const reference =
    record.reference ??
    record.tx_ref ??
    record.txRef ??
    data?.reference ??
    data?.tx_ref ??
    data?.txRef;

  return typeof reference === "string" && reference.trim()
    ? reference.trim()
    : null;
}

export async function GET(request: Request) {
  const parsed = parseSearchParams(
    chapaCallbackQuerySchema,
    new URL(request.url).searchParams,
  );
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payout callback query");
  }

  const reference =
    parsed.data.reference ?? parsed.data.tx_ref ?? parsed.data.txRef ?? "";
  if (!reference) {
    return NextResponse.json({ error: "Missing payout reference" }, { status: 400 });
  }

  try {
    const payout = await reconcilePitchOwnerPayout({ reference });
    return NextResponse.json({ payout }, { status: 200 });
  } catch (error) {
    logger.error("Failed to reconcile payout callback", error);
    return NextResponse.json(
      { error: "Payout callback reconciliation failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(chapaCallbackPayloadSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payout callback payload");
  }

  const reference = extractReference(parsed.data);
  if (!reference) {
    return NextResponse.json({ error: "Missing payout reference" }, { status: 400 });
  }

  try {
    const payout = await reconcilePitchOwnerPayout({
      reference,
      payload: JSON.parse(JSON.stringify(parsed.data)) as Prisma.JsonObject,
    });
    return NextResponse.json({ payout }, { status: 200 });
  } catch (error) {
    logger.error("Failed to reconcile payout callback", error);
    return NextResponse.json(
      { error: "Payout callback reconciliation failed" },
      { status: 500 },
    );
  }
}
