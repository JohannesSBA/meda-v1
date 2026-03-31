import { BookingStatus, TicketStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { canScanEvent } from "@/lib/auth/roles";
import { parseVerificationToken } from "@/lib/tickets/verificationToken";

type AuthUser = { id: string; name: string | null; email: string | null };

export type ScannerUser = {
  id?: string | null;
  role?: string | null;
  parentPitchOwnerUserId?: string | null;
} | null;

type VerifiedEventTicket = {
  kind: "event_attendee";
  attendeeId: string;
  attendee: Awaited<ReturnType<typeof prisma.eventAttendee.findUnique>>;
  scannerUserId: string | null;
  canScan: boolean;
  baseResponse: {
    valid: true;
    eventName: string;
    eventDatetime: string;
    addressLabel: string | null;
    attendeeName: string | null;
  };
  previousScan: {
    scannedAt: string;
    scannedByName: string;
  } | null;
};

type VerifiedBookingTicket = {
  kind: "booking_ticket";
  bookingTicketId: string;
  scannerUserId: string | null;
  canScan: boolean;
  bookingTicket: {
    id: string;
    status: TicketStatus;
    checkedInAt: Date | null;
    assignedName: string | null;
    assignedEmail: string | null;
    booking: {
      id: string;
      status: BookingStatus;
      slot: {
        pitch: {
          id: string;
          ownerId: string;
          name: string;
          addressLabel: string | null;
        };
        startsAt: Date;
      };
    };
  };
  baseResponse: {
    valid: true;
    eventName: string;
    eventDatetime: string;
    addressLabel: string | null;
    attendeeName: string | null;
  };
  previousScan: {
    scannedAt: string;
    scannedByName: string;
  } | null;
};

export type VerifiedTicketResolution = VerifiedEventTicket | VerifiedBookingTicket;

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

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as {
    code?: string;
    message?: string;
    meta?: { code?: string };
  };
  return (
    record.code === "23505" ||
    record.meta?.code === "23505" ||
    (typeof record.message === "string" && record.message.includes("duplicate key"))
  );
}

export async function resolveVerifiedTicket(
  token: string,
  expectedEventId: string | null,
  scannerUser: ScannerUser,
) : Promise<VerifiedTicketResolution> {
  const payload = parseVerificationToken(token);
  if (!payload) {
    throw new Error("Invalid or expired ticket");
  }

  if (payload.kind === "booking_ticket") {
    const bookingTicket = await prisma.bookingTicket.findUnique({
      where: { id: payload.id },
      include: {
        booking: {
          include: {
            slot: {
              include: {
                pitch: {
                  select: {
                    id: true,
                    ownerId: true,
                    name: true,
                    addressLabel: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!bookingTicket) {
      throw new Error("Ticket not found");
    }
    if (
      bookingTicket.booking.status !== BookingStatus.CONFIRMED &&
      bookingTicket.booking.status !== BookingStatus.COMPLETED
    ) {
      throw new Error("This ticket is not ready yet.");
    }
    if (
      bookingTicket.status !== TicketStatus.ASSIGNED &&
      bookingTicket.status !== TicketStatus.VALID &&
      bookingTicket.status !== TicketStatus.CHECKED_IN
    ) {
      throw new Error("This ticket still needs a player name.");
    }

    const scannerUserId = scannerUser?.id ?? null;
    const canScan =
      scannerUser?.role === "admin" ||
      scannerUserId === bookingTicket.booking.slot.pitch.ownerId ||
      (scannerUser?.role === "facilitator" &&
        scannerUser?.parentPitchOwnerUserId === bookingTicket.booking.slot.pitch.ownerId);

    return {
      kind: "booking_ticket",
      bookingTicketId: bookingTicket.id,
      bookingTicket,
      scannerUserId,
      canScan,
      baseResponse: {
        valid: true,
        eventName: bookingTicket.booking.slot.pitch.name,
        eventDatetime: bookingTicket.booking.slot.startsAt.toISOString(),
        addressLabel: bookingTicket.booking.slot.pitch.addressLabel ?? null,
        attendeeName:
          bookingTicket.assignedName ??
          bookingTicket.assignedEmail ??
          "Assigned player",
      },
      previousScan: bookingTicket.checkedInAt
        ? {
            scannedAt: bookingTicket.checkedInAt.toISOString(),
            scannedByName: "Host",
          }
        : null,
    };
  }

  const attendeeId = payload.id;

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
    kind: "event_attendee",
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
  resolved: VerifiedTicketResolution;
  scannerUser: ScannerUser;
}) {
  if (params.resolved.kind === "booking_ticket") {
    const scannerUserId = params.scannerUser?.id ?? null;
    if (!scannerUserId) {
      return false;
    }

    if (params.resolved.bookingTicket.status === TicketStatus.CHECKED_IN) {
      return false;
    }

    const updated = await prisma.bookingTicket.updateMany({
      where: {
        id: params.resolved.bookingTicketId,
        status: {
          in: [TicketStatus.ASSIGNED, TicketStatus.VALID],
        },
      },
      data: {
        status: TicketStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });

    if (updated.count > 0) {
      await prisma.hostActivityLog.create({
        data: {
          ownerId: params.resolved.bookingTicket.booking.slot.pitch.ownerId,
          pitchId: params.resolved.bookingTicket.booking.slot.pitch.id,
          entityType: "ticket",
          entityId: params.resolved.bookingTicketId,
          action: "ticket.checked_in",
          metadataJson: {
            bookingId: params.resolved.bookingTicket.booking.id,
            checkedInByUserId: scannerUserId,
            source: "qr_scan",
          },
        },
      });
    }

    return updated.count > 0;
  }

  let insertResult: Array<{
    scan_id: string;
    scanned_at: Date;
    scanned_by_user_id: string;
    inserted: boolean;
  }> = [];

  const attendee = params.resolved.attendee;
  if (!attendee) {
    return false;
  }

  try {
    insertResult = await prisma.$queryRaw<
      Array<{
        scan_id: string;
        scanned_at: Date;
        scanned_by_user_id: string;
        inserted: boolean;
      }>
    >`
      INSERT INTO ticket_scan (scan_id, attendee_id, event_id, scanned_by_user_id, scanned_at)
      VALUES (gen_random_uuid(), ${params.resolved.attendeeId}::uuid, ${attendee.eventId}::uuid, ${params.resolved.scannerUserId}::uuid, NOW())
      ON CONFLICT (attendee_id) DO NOTHING
      RETURNING scan_id, scanned_at, scanned_by_user_id, true AS inserted
    `;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }

  return insertResult.length > 0;
}
