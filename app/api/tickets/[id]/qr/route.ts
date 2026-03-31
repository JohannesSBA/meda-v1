import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createVerificationToken } from "@/lib/tickets/verificationToken";
import { requireSessionUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/env";
import { ticketIdParamSchema } from "@/lib/validations/bookingInventory";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const resolvedParams = await params;
  const parsed = parseParams(ticketIdParamSchema, { id: resolvedParams.id });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid ticket");
  }
  const { id } = parsed.data;

  const attendee = await prisma.eventAttendee.findFirst({
    where: { attendeeId: id, userId: user.id },
  });

  const baseUrl = getAppBaseUrl();

  if (attendee) {
    const token = createVerificationToken(attendee.attendeeId, "event_attendee");
    const verifyUrl = `${baseUrl}/tickets/verify/${token}`;

    const png = await QRCode.toBuffer(verifyUrl, {
      type: "png",
      width: 256,
      margin: 2,
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const bookingTicket = await prisma.bookingTicket.findFirst({
    where: {
      id,
      OR: [
        { purchaserId: user.id },
        { assignedUserId: user.id },
        ...(user.email ? [{ assignedEmail: user.email.trim().toLowerCase() }] : []),
      ],
      booking: {
        status: {
          in: ["CONFIRMED", "COMPLETED"],
        },
      },
    },
  });

  if (!bookingTicket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const token = createVerificationToken(bookingTicket.id, "booking_ticket");
  const verifyUrl = `${baseUrl}/tickets/verify/${token}`;

  const png = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    width: 256,
    margin: 2,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
