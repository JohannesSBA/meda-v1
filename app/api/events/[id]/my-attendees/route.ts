import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const { id: eventId } = await params;

  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId, userId: user.id },
    select: { attendeeId: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    attendeeIds: attendees.map((a) => a.attendeeId),
  });
}
