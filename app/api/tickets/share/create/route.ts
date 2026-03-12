import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { createShareLinkSchema } from "@/lib/validations/ticketSharing";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { createShareLink } from "@/services/ticketSharing";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown share-link error";
  }
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(`share-create:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before creating another share link." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const parsed = await parseJsonBody(createShareLinkSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid share-link payload");
  }

  const baseUrl = new URL(request.url).origin;
  try {
    const result = await createShareLink({
      eventId: parsed.data.eventId,
      ownerUserId: session.user.id,
      baseUrl,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
