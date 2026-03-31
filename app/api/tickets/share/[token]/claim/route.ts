import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { isBookingTicketShareToken } from "@/lib/tickets/bookingShareToken";
import { claimShareLink } from "@/services/ticketSharing";
import { claimBookingTicketShareLink } from "@/services/bookingTicketSharing";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { shareTokenParamSchema } from "@/lib/validations/ticketSharing";
import { revalidateEventData } from "@/lib/revalidation";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown share-link error";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = await checkRateLimit(`share-claim:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many claim attempts. Please wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const parsed = parseParams(shareTokenParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid share token");
  }
  const { token } = parsed.data;
  try {
    if (isBookingTicketShareToken(token)) {
      const result = await claimBookingTicketShareLink({
        token,
        claimantUserId: session.user.id,
      });
      revalidatePath("/tickets");
      revalidatePath("/play");
      revalidatePath("/host");
      return NextResponse.json(result, { status: 200 });
    }

    const result = await claimShareLink({
      token,
      claimantUserId: session.user.id,
    });
    revalidateEventData(result.eventId, [session.user.id]);
    revalidatePath("/my-events");
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
