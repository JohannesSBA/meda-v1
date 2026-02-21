import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callNeonAdminGet } from "@/lib/auth/neonAdmin";
import { requireAdminUser } from "@/lib/auth/guards";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function extractTotalUsers(raw: unknown) {
  const body = (raw ?? null) as
    | {
        total?: number;
        users?: unknown[];
        data?: { total?: number; users?: unknown[] };
      }
    | null;
  const total =
    body?.total ??
    body?.data?.total ??
    body?.users?.length ??
    body?.data?.users?.length ??
    0;
  return Number(total) || 0;
}

export async function GET(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const [eventsTotal, attendeesTotal, events7, events30, attendees7, attendees30, recurringSeries, neonUsers] =
    await Promise.all([
      prisma.event.count(),
      prisma.eventAttendee.count(),
      prisma.event.count({ where: { createdAt: { gte: daysAgo(7) } } }),
      prisma.event.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      prisma.eventAttendee.count({ where: { createdAt: { gte: daysAgo(7) } } }),
      prisma.eventAttendee.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      prisma.event.groupBy({
        by: ["seriesId"],
        where: { seriesId: { not: null } },
      }),
      callNeonAdminGet(request, "admin/list-users", { limit: 1, offset: 0 }),
    ]);

  const totalUsers = neonUsers.error ? 0 : extractTotalUsers(neonUsers.data);

  return NextResponse.json({
    cards: {
      totalUsers,
      totalEvents: eventsTotal,
      totalRegistrations: attendeesTotal,
      recurringSeries: recurringSeries.length,
    },
    trends: {
      eventsLast7Days: events7,
      eventsLast30Days: events30,
      registrationsLast7Days: attendees7,
      registrationsLast30Days: attendees30,
    },
    neonUsersError: neonUsers.error,
  });
}
