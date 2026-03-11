import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { sendTicketConfirmationEmail } from "@/services/email";
import { logger } from "@/lib/logger";

/**
 * Pay for tickets using the user's Meda balance.
 * Supports full balance payment or partial (balance + Chapa remainder).
 * This route handles the balance-only case; for partial payments,
 * the balance portion is deducted here and the remaining is paid via Chapa.
 */
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

  const { eventId, quantity: rawQty } = body as { eventId?: string; quantity?: number };
  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(rawQty) || 1)));

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventName: true,
      eventDatetime: true,
      eventEndtime: true,
      eventLocation: true,
      capacity: true,
      priceField: true,
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.eventEndtime <= new Date()) {
    return NextResponse.json({ error: "Event has ended" }, { status: 400 });
  }
  if (!event.priceField || event.priceField <= 0) {
    return NextResponse.json({ error: "This event does not require payment" }, { status: 400 });
  }
  if (event.capacity != null && quantity > event.capacity) {
    return NextResponse.json({ error: "Not enough seats available" }, { status: 400 });
  }

  const totalCost = event.priceField * quantity;

  const userBalance = await prisma.userBalance.findUnique({
    where: { userId },
  });

  const availableBalance = userBalance ? Number(userBalance.balanceEtb) : 0;

  if (availableBalance < totalCost) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        availableBalance,
        totalCost,
        shortfall: totalCost - availableBalance,
      },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const bal = await tx.userBalance.findUnique({ where: { userId } });
      if (!bal || Number(bal.balanceEtb) < totalCost) {
        throw new Error("Insufficient balance");
      }

      await tx.userBalance.update({
        where: { userId },
        data: { balanceEtb: { decrement: totalCost } },
      });

      if (event.capacity != null) {
        const updated = await tx.event.updateMany({
          where: { eventId, capacity: { gte: quantity } },
          data: { capacity: { decrement: quantity } },
        });
        if (updated.count === 0) throw new Error("Not enough seats available");
      }

      await tx.eventAttendee.createMany({
        data: Array.from({ length: quantity }).map(() => ({
          eventId,
          userId,
          status: "RSVPed" as const,
        })),
      });

      await tx.payment.create({
        data: {
          eventId,
          userId,
          amountEtb: totalCost,
          currency: "ETB",
          status: "succeeded",
          telebirrPrepayId: `BALANCE-${Date.now()}`,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");

  if (session.user.email) {
    const decoded = decodeEventLocation(event.eventLocation);
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId, userId },
      select: { attendeeId: true },
      orderBy: { createdAt: "desc" },
    });
    try {
      await sendTicketConfirmationEmail({
        to: session.user.email,
        buyerName: session.user.name ?? null,
        eventName: event.eventName,
        eventDateTime: event.eventDatetime,
        eventEndTime: event.eventEndtime,
        locationLabel: decoded.addressLabel,
        quantity,
        eventId,
        attendeeIds: attendees.map((a) => a.attendeeId),
        baseUrl: new URL(request.url).origin,
      });
    } catch (err) {
      logger.error("Failed to send ticket confirmation email", err);
    }
  }

  const updatedBalance = await prisma.userBalance.findUnique({ where: { userId } });

  return NextResponse.json(
    {
      ok: true,
      quantity,
      amountPaid: totalCost,
      newBalance: updatedBalance ? Number(updatedBalance.balanceEtb) : 0,
    },
    { status: 200 },
  );
}
