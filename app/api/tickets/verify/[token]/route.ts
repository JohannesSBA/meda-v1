import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/tickets/verificationToken";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { auth } from "@/lib/auth/server";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";

type AuthUser = { id: string; name: string | null; email: string | null };

const ALLOWED_SCHEMAS = ["neon_auth", "public"];
const ALLOWED_TABLES = ["user", "users"];

async function getAttendeeName(userId: string): Promise<string | null> {
  try {
    const schema =
      process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
        ? process.env.AUTH_SCHEMA
        : "neon_auth";
    const table =
      process.env.AUTH_USER_TABLE && ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = await checkRateLimit(`verify:${getClientId(request)}`, 30, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { valid: false, error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const expectedEventId = searchParams.get("eventId")?.trim() || null;

  const attendeeId = verifyToken(token);
  if (!attendeeId) {
    return NextResponse.json(
      { valid: false, error: "Invalid or expired ticket" },
      { status: 400 },
    );
  }

  const attendee = await prisma.eventAttendee.findUnique({
    where: { attendeeId },
    include: {
      event: true,
    },
  });

  if (!attendee) {
    return NextResponse.json(
      { valid: false, error: "Ticket not found" },
      { status: 404 },
    );
  }

  const decoded = decodeEventLocation(attendee.event.eventLocation);
  const attendeeName = await getAttendeeName(attendee.userId);

  let session: { user?: { id: string; role?: string } } | null = null;
  try {
    const { data } = await auth.getSession();
    session = data as { user?: { id: string; role?: string } } | null;
  } catch {
    // No session — return basic info only
  }

  const isAdmin = session?.user?.role === "admin";
  const scannerUserId = session?.user?.id;
  const isEventOwner = scannerUserId != null && attendee.event.userId === scannerUserId;
  const canScan = isAdmin || isEventOwner;

  if (canScan && expectedEventId && attendee.event.eventId !== expectedEventId) {
    return NextResponse.json(
      {
        valid: false,
        error: "Ticket is for a different event",
        eventName: attendee.event.eventName,
      },
      { status: 400 },
    );
  }

  const baseResponse = {
    valid: true,
    eventName: attendee.event.eventName,
    eventDatetime: attendee.event.eventDatetime.toISOString(),
    addressLabel: decoded.addressLabel,
    attendeeName,
  };

  if (!canScan || !scannerUserId) {
    return NextResponse.json(baseResponse);
  }

  // Atomic upsert: insert returns the row, conflict means already scanned
  const insertResult = await prisma.$queryRaw<
    Array<{ scan_id: string; scanned_at: Date; scanned_by_user_id: string; inserted: boolean }>
  >`
    INSERT INTO ticket_scan (scan_id, attendee_id, event_id, scanned_by_user_id, scanned_at)
    VALUES (gen_random_uuid(), ${attendeeId}::uuid, ${attendee.eventId}::uuid, ${scannerUserId}::uuid, NOW())
    ON CONFLICT (attendee_id) DO NOTHING
    RETURNING scan_id, scanned_at, scanned_by_user_id, true AS inserted
  `.catch(() => []);

  if (insertResult.length > 0) {
    // Successfully recorded this scan — first time
    return NextResponse.json({
      ...baseResponse,
      alreadyScanned: false,
    });
  }

  // Row already existed — fetch the original scan details
  const previousScan = await prisma.$queryRaw<
    Array<{ scan_id: string; scanned_at: Date; scanned_by_user_id: string }>
  >`
    SELECT scan_id, scanned_at, scanned_by_user_id
    FROM ticket_scan
    WHERE attendee_id = ${attendeeId}::uuid
    ORDER BY scanned_at DESC
    LIMIT 1
  `.catch(() => []);

  const firstScan = previousScan[0];
  if (firstScan) {
    const scannedByName = await getAttendeeName(firstScan.scanned_by_user_id);
    return NextResponse.json({
      ...baseResponse,
      alreadyScanned: true,
      previousScan: {
        scannedAt: firstScan.scanned_at.toISOString(),
        scannedByName: scannedByName ?? "Unknown",
      },
    });
  }

  return NextResponse.json({ ...baseResponse, alreadyScanned: false });
}
