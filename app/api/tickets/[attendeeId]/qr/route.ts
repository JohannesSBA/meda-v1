import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createVerificationToken } from "@/lib/tickets/verificationToken";
import { requireSessionUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/env";
import { attendeeIdParamSchema } from "@/lib/validations/events";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attendeeId: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const parsed = parseParams(attendeeIdParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid attendee");
  }
  const { attendeeId } = parsed.data;

  const attendee = await prisma.eventAttendee.findFirst({
    where: { attendeeId, userId: user.id },
  });

  if (!attendee) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const baseUrl = getAppBaseUrl();
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
