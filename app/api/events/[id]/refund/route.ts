import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { processRefund } from "@/services/refunds";
import { eventIdParamSchema, refundSchema } from "@/lib/validations/events";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { revalidateEventData } from "@/lib/revalidation";

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
