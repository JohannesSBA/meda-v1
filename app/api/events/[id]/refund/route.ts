import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { processRefund } from "@/services/refunds";
import { refundSchema } from "@/lib/validations/events";

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

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = refundSchema.safeParse(body);
  const ticketCount = parsed.success ? parsed.data.ticketCount : undefined;

  try {
    const result = await processRefund(id, session.user.id, ticketCount);

    revalidatePath(`/events/${id}`);
    revalidatePath("/events");

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
