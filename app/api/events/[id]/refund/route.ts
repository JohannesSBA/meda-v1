import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { getRefundQuote, processRefund } from "@/services/refunds";
import { eventIdParamSchema, refundSchema } from "@/lib/validations/events";
import {
  parseJsonBody,
  parseParams,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { revalidateEventData } from "@/lib/revalidation";

const refundQuoteQuerySchema = z.object({
  ticketCount: z.coerce
    .number()
    .transform((value) => Math.max(1, Math.floor(value)))
    .optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const paramParse = parseParams(eventIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid event id");
  }
  const { id } = paramParse.data;

  const url = new URL(request.url);
  const queryParse = parseSearchParams(refundQuoteQuerySchema, url.searchParams);
  if (!queryParse.success) {
    return validationErrorResponse(queryParse.error, "Invalid refund quote query");
  }

  try {
    const result = await getRefundQuote(
      id,
      session.user.id,
      queryParse.data.ticketCount,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load refund quote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await checkRateLimit(`refund:${getClientId(request)}`, 5, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const paramParse = parseParams(eventIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid event id");
  }
  const { id } = paramParse.data;

  const parsed = await parseJsonBody(refundSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid refund payload");
  }
  const ticketCount = parsed.data.ticketCount;

  try {
    const result = await processRefund(id, session.user.id, ticketCount);

    revalidateEventData(id, [session.user.id]);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
