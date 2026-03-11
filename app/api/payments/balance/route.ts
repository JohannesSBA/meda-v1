/**
 * Pay for tickets using the user's Meda balance.
 * Supports full balance payment or partial (balance + Chapa remainder).
 * This route handles the balance-only case; for partial payments,
 * the balance portion is deducted here and the remaining is paid via Chapa.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { checkoutPaymentSchema } from "@/lib/validations/payments";
import { payWithBalance, InsufficientBalanceError } from "@/services/payments";

export async function POST(request: Request) {
  const rl = await checkRateLimit(`balance-pay:${getClientId(request)}`, 5, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = checkoutPaymentSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const eventIdErr = issues.fieldErrors.eventId?.[0];
    const quantityErr = issues.fieldErrors.quantity?.[0];
    const error = eventIdErr
      ? (body.eventId === undefined ? "eventId is required" : eventIdErr)
      : quantityErr ?? "Invalid request body";
    return NextResponse.json({ error }, { status: 400 });
  }

  const { eventId, quantity } = parsed.data;

  try {
    const result = await payWithBalance({
      eventId,
      userId,
      quantity,
      userEmail: session.user.email ?? null,
      userName: session.user.name ?? null,
      baseUrl: new URL(request.url).origin,
    });

    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");

    return NextResponse.json(
      {
        ok: result.ok,
        quantity: result.quantity,
        amountPaid: result.amountPaid,
        newBalance: result.newBalance,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          availableBalance: error.availableBalance,
          totalCost: error.totalCost,
          shortfall: error.shortfall,
        },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Payment failed";
    const status =
      message.includes("Event not found")
        ? 404
        : message.includes("ended") ||
            message.includes("does not require payment") ||
            message.includes("seats") ||
            message.includes("Insufficient balance")
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
