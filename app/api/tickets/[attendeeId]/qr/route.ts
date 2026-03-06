import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createVerificationToken } from "@/lib/tickets/verificationToken";
import { requireSessionUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attendeeId: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const { attendeeId } = await params;
  if (!attendeeId || !/^[0-9a-fA-F-]{36}$/.test(attendeeId)) {
    return NextResponse.json({ error: "Invalid attendee" }, { status: 400 });
  }

  const attendee = await prisma.eventAttendee.findFirst({
    where: { attendeeId, userId: user.id },
  });

  if (!attendee) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";
  const token = createVerificationToken(attendeeId);
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
