import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { eventIdParamSchema } from "@/lib/validations/events";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = parseParams(eventIdParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event id");
  }
  const { id } = parsed.data;
  const event = await prisma.event.findUnique({ where: { eventId: id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const baseUrl = getAppBaseUrl();
  const eventUrl = `${baseUrl}/events/${id}`;
  const location = resolveEventLocation(event).addressLabel ?? event.eventLocation ?? "";

  const start = new Date(event.eventDatetime);
  const end = new Date(event.eventEndtime);
  const now = new Date();

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meda//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}@meda.app`,
    `DTSTAMP:${formatICSDate(now)}Z`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${escapeICS(event.eventName)}`,
    `DESCRIPTION:${escapeICS((event.description ?? "") + "\\n\\n" + eventUrl)}`,
    location ? `LOCATION:${escapeICS(location)}` : null,
    `URL:${eventUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.eventName.replace(/[^a-zA-Z0-9-_]/g, "_")}.ics"`,
    },
  });
}
