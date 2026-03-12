import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { auth } from "@/lib/auth/server";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import {
  eventIdParamSchema,
  eventDetailQuerySchema,
  eventRegistrationSchema,
} from "@/lib/validations/events";
import {
  parseJsonBody,
  parseParams,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { registerForEvent } from "@/services/registrations";
import { revalidateEventData } from "@/lib/revalidation";
import { getPublicEventDetail } from "@/services/publicEvents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const paramParse = parseParams(eventIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid event id");
  }

  const { id } = paramParse.data;
  const url = new URL(request.url);
  const queryParse = parseSearchParams(eventDetailQuerySchema, url.searchParams);
  if (!queryParse.success) {
    return validationErrorResponse(queryParse.error, "Invalid event query");
  }
  const { userId } = queryParse.data;

  let viewerUserId: string | null = null;
  if (userId) {
    try {
      const { data: sessionData } = await auth.getSession();
      const sessionUserId = (sessionData?.user as { id?: string } | null)?.id;
      if (sessionUserId === userId) {
        viewerUserId = userId;
      }
    } catch {
      viewerUserId = null;
    }
  }

  const event = await getPublicEventDetail(id, viewerUserId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(
    { event },
    {
      status: 200,
      headers:
        viewerUserId == null
          ? {
              "Cache-Control":
                "public, s-maxage=60, stale-while-revalidate=300",
            }
          : {
              "Cache-Control": "private, no-store",
            },
    },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await checkRateLimit(`register:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before registering again." },
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
  const parsed = await parseJsonBody(eventRegistrationSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid request body");
  }
  const { quantity: qty, userId } = parsed.data;

  if (userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await registerForEvent({
      eventId: id,
      userId,
      quantity: qty,
      userEmail: session.user.email ?? null,
      userName: session.user.name ?? null,
      baseUrl: new URL(request.url).origin,
    });

    revalidateEventData(id, [userId]);

    return NextResponse.json(
      { ok: result.ok, attendeeCount: result.attendeeCount },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register";
    const status =
      message.includes("Event not found")
        ? 404
        : message.includes("ended") ||
            message.includes("seats") ||
            message.includes("hold at most")
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
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

  const { processRefund } = await import("@/services/refunds");

  try {
    const result = await processRefund(id, session.user.id);

    revalidateEventData(id, [session.user.id]);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel tickets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
