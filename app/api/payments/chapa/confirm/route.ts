import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";
import { confirmPaymentSchema } from "@/lib/validations/payments";
import { confirmChapaPayment } from "@/services/payments";
import { sendTicketConfirmationEmail } from "@/services/email";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const rl = await checkRateLimit(`confirm:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before confirming payment again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) {
    return session.response!;
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await confirmChapaPayment({
      txRef: parsed.data.txRef,
      userId: session.user.id,
    });

    if (result.eventId) {
      revalidatePath(`/events/${result.eventId}`);
      revalidatePath("/events");

      if (
        result.quantity > 0 &&
        session.user.email &&
        !result.alreadyConfirmed
      ) {
        const event = await prisma.event.findUnique({
          where: { eventId: result.eventId },
          select: {
            eventName: true,
            eventDatetime: true,
            eventEndtime: true,
            eventLocation: true,
          },
        });
        if (event) {
          const decoded = decodeEventLocation(event.eventLocation);
          const attendees = await prisma.eventAttendee.findMany({
            where: { eventId: result.eventId, userId: session.user.id },
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
              quantity: result.quantity,
              eventId: result.eventId,
              attendeeIds: attendees.map((a) => a.attendeeId),
              baseUrl: new URL(request.url).origin,
            });
          } catch (emailErr) {
            logger.error("Failed to send ticket confirmation email", emailErr);
          }
        }
      }
    }

    return NextResponse.json(
      { quantity: result.quantity },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Chapa payment confirmation failed", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
