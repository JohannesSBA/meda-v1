import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { sendTicketConfirmationEmail } from "@/services/email";

const ALLOWED_SCHEMAS = ["neon_auth", "public"];
const ALLOWED_TABLES = ["user"];

type AuthUser = { id: string; email: string | null; name: string | null };

async function getAuthUserEmails(
  userIds: string[],
): Promise<Map<string, AuthUser>> {
  const map = new Map<string, AuthUser>();
  if (userIds.length === 0) return map;

  const schema =
    process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
      ? process.env.AUTH_SCHEMA
      : "neon_auth";
  const table =
    process.env.AUTH_USER_TABLE && ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
      ? process.env.AUTH_USER_TABLE
      : "user";

  try {
    const qualifiedTable = `"${schema}"."${table}"`;
    const rows = await prisma.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, email, name FROM ${qualifiedTable} WHERE id = ANY($1::uuid[]) AND email IS NOT NULL`,
      userIds,
    );
    for (const row of rows ?? []) {
      if (row.email) map.set(row.id, row);
    }
  } catch (err) {
    console.error("Failed to fetch auth users for waitlist promotion:", err);
  }
  return map;
}

/**
 * Promotes waitlisted users to attendees when the event has capacity > 0.
 * Promotes in FIFO order (by waitlist createdAt).
 * Returns the number of users promoted.
 */
export async function promoteWaitlistForEvent(eventId: string): Promise<number> {
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: {
      waitlist: { orderBy: { createdAt: "asc" } },
    },
  });

  if (
    !event ||
    event.capacity == null ||
    event.capacity <= 0 ||
    event.waitlist.length === 0
  ) {
    return 0;
  }

  const toPromote = Math.min(event.capacity, event.waitlist.length);
  const waitlistSlice = event.waitlist.slice(0, toPromote);
  const userIds = waitlistSlice.map((w) => w.userId);
  const userMap = await getAuthUserEmails(userIds);
  const decoded = decodeEventLocation(event.eventLocation);

  let promoted = 0;

  await prisma.$transaction(async (tx) => {
    for (const w of waitlistSlice) {
      const updated = await tx.event.updateMany({
        where: { eventId, capacity: { gte: 1 } },
        data: { capacity: { decrement: 1 } },
      });
      if (updated.count === 0) break;

      await tx.eventAttendee.create({
        data: {
          eventId,
          userId: w.userId,
          status: "RSVPed",
        },
      });
      await tx.eventWaitlist.delete({
        where: { eventId_userId: { eventId, userId: w.userId } },
      });
      promoted++;
    }
  });

  for (let i = 0; i < promoted; i++) {
    const w = waitlistSlice[i];
    const user = userMap.get(w.userId);
    if (user?.email) {
      try {
        await sendTicketConfirmationEmail({
          to: user.email,
          buyerName: user.name,
          eventName: event.eventName,
          eventDateTime: event.eventDatetime,
          eventEndTime: event.eventEndtime,
          locationLabel: decoded.addressLabel,
          quantity: 1,
          eventId,
        });
      } catch (err) {
        console.error(
          `Failed to send waitlist promotion email for ${eventId} / ${w.userId}:`,
          err,
        );
      }
    }
  }

  return promoted;
}
