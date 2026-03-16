import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import {
  parseJsonBody,
  parseParams,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import {
  ticketTokenParamSchema,
  ticketVerificationRequestSchema,
} from "@/lib/validations/tickets";
import {
  recordTicketScan,
  resolveVerifiedTicket,
} from "@/services/ticketVerification";

async function getScanSession() {
  try {
    const { data } = await auth.getSession();
    return (data?.user ?? null) as {
      id?: string;
      role?: string;
      parentPitchOwnerUserId?: string | null;
    } | null;
  } catch {
    return null;
  }
}

function toTicketErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to verify ticket";
  const status =
    message.includes("expired") || message.includes("different event")
      ? 400
      : message.includes("not found")
        ? 404
        : 400;

  return NextResponse.json(
    { valid: false, error: message },
    { status },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = await checkRateLimit(`verify:${getClientId(request)}`, 30, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { valid: false, error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const paramParse = parseParams(ticketTokenParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid ticket token");
  }

  const queryParse = parseSearchParams(
    ticketVerificationRequestSchema,
    new URL(request.url).searchParams,
  );
  if (!queryParse.success) {
    return validationErrorResponse(
      queryParse.error,
      "Invalid ticket verification query",
    );
  }

  try {
    const resolved = await resolveVerifiedTicket(
      paramParse.data.token,
      queryParse.data.eventId ?? null,
      await getScanSession(),
    );

    return NextResponse.json({
      ...resolved.baseResponse,
      alreadyScanned: Boolean(resolved.previousScan),
      previousScan: resolved.previousScan,
      canScan: resolved.canScan,
    });
  } catch (error) {
    return toTicketErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = await checkRateLimit(`scan:${getClientId(request)}`, 30, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { valid: false, error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const paramParse = parseParams(ticketTokenParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid ticket token");
  }

  const bodyParse = await parseJsonBody(ticketVerificationRequestSchema, request);
  if (!bodyParse.success) {
    return validationErrorResponse(
      bodyParse.error,
      "Invalid ticket verification payload",
    );
  }

  try {
    const resolved = await resolveVerifiedTicket(
      paramParse.data.token,
      bodyParse.data.eventId ?? null,
      await getScanSession(),
    );

    if (!resolved.canScan || !resolved.scannerUserId) {
      return NextResponse.json(
        { valid: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const inserted = await recordTicketScan({
      attendeeId: resolved.attendeeId,
      eventId: resolved.attendee.eventId,
      scannerUserId: resolved.scannerUserId,
    });

    return NextResponse.json(
      inserted
        ? {
            ...resolved.baseResponse,
            alreadyScanned: false,
          }
        : {
            ...resolved.baseResponse,
            alreadyScanned: true,
            previousScan: resolved.previousScan,
          },
    );
  } catch (error) {
    return toTicketErrorResponse(error);
  }
}
