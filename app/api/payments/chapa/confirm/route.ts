import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";
import { confirmPaymentSchema } from "@/lib/validations/payments";
import { confirmChapaPayment } from "@/services/payments";
import { sendTicketConfirmationEmail } from "@/services/email";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown confirm error";
  }
}

export async function POST(request: Request) {
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
          try {
            await sendTicketConfirmationEmail({
              to: session.user.email,
              buyerName: session.user.name ?? null,
              eventName: event.eventName,
              eventDateTime: event.eventDatetime,
              eventEndTime: event.eventEndtime,
              locationLabel: decoded.addressLabel,
              quantity: result.quantity,
            });
          } catch (emailErr) {
            console.error("Failed to send ticket confirmation email:", emailErr);
          }
        }
      }
    }

    return NextResponse.json(
      { quantity: result.quantity },
      { status: 200 }
    );
  } catch (error) {
    const message = formatUnknownError(error);
    console.error("Chapa payment confirmation failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
