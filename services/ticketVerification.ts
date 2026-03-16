import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { canScanEvent } from "@/lib/auth/roles";
import { verifyToken } from "@/lib/tickets/verificationToken";

type AuthUser = { id: string; name: string | null; email: string | null };

export type ScannerUser = {
  id?: string | null;
  role?: string | null;
  parentPitchOwnerUserId?: string | null;
} | null;

const ALLOWED_SCHEMAS = ["neon_auth", "public"];
const ALLOWED_TABLES = ["user", "users"];

async function getAttendeeName(userId: string): Promise<string | null> {
  try {
    const schema =
      process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
        ? process.env.AUTH_SCHEMA
        : "neon_auth";
    const table =
      process.env.AUTH_USER_TABLE &&
      ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
        ? process.env.AUTH_USER_TABLE
        : "user";
    const rows = await prisma.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, name, email FROM "${schema}"."${table}" WHERE id = $1::uuid`,
      userId,
    );
    const row = rows?.[0];
    if (row?.name) return row.name;
    if (row?.email) return row.email.split("@")[0] ?? row.email;
    return null;
  } catch {
    return null;
  }
}

export async function resolveVerifiedTicket(
  token: string,
  expectedEventId: string | null,
  scannerUser: ScannerUser,
) {
  const attendeeId = verifyToken(token);
  if (!attendeeId) {
    throw new Error("Invalid or expired ticket");
  }

  const attendee = await prisma.eventAttendee.findUnique({
    where: { attendeeId },
    include: { event: true },
  });
  if (!attendee) {
    throw new Error("Ticket not found");
  }

  const scannerUserId = scannerUser?.id ?? null;
  const canScan = canScanEvent(scannerUser, attendee.event.userId);

  if (canScan && expectedEventId && attendee.event.eventId !== expectedEventId) {
    throw new Error("Ticket is for a different event");
  }

  const location = resolveEventLocation(attendee.event);
  const attendeeName = await getAttendeeName(attendee.userId);
  const previousScan = await prisma.ticketScan.findUnique({
    where: { attendeeId },
    select: { scannedAt: true, scannedByUserId: true },
  });
  const scannedByName = previousScan?.scannedByUserId
    ? await getAttendeeName(previousScan.scannedByUserId)
    : null;

  return {
    attendeeId,
    attendee,
    scannerUserId,
    canScan,
    baseResponse: {
      valid: true,
      eventName: attendee.event.eventName,
      eventDatetime: attendee.event.eventDatetime.toISOString(),
      addressLabel: location.addressLabel,
      attendeeName,
    },
    previousScan: previousScan
      ? {
          scannedAt: previousScan.scannedAt.toISOString(),
          scannedByName: scannedByName ?? "Unknown",
        }
      : null,
  };
}

export async function recordTicketScan(params: {
  attendeeId: string;
  eventId: string;
  scannerUserId: string;
}) {
  const insertResult = await prisma.$queryRaw<
    Array<{
      scan_id: string;
      scanned_at: Date;
      scanned_by_user_id: string;
      inserted: boolean;
    }>
  >`
    INSERT INTO ticket_scan (scan_id, attendee_id, event_id, scanned_by_user_id, scanned_at)
    VALUES (gen_random_uuid(), ${params.attendeeId}::uuid, ${params.eventId}::uuid, ${params.scannerUserId}::uuid, NOW())
    ON CONFLICT (attendee_id) DO NOTHING
    RETURNING scan_id, scanned_at, scanned_by_user_id, true AS inserted
  `.catch(() => []);

  return insertResult.length > 0;
}
