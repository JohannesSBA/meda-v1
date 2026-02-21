import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { uploadEventImageUnified } from "@/lib/uploadEventImage";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB per supabase guidance
const MAX_RECURRING_OCCURRENCES = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

type RecurrenceFrequency = "daily" | "weekly" | "custom";

type OccurrenceWindow = {
  start: Date;
  end: Date;
  index: number;
};

function toDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMidnightUtc(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function buildRecurringWindows(params: {
  start: Date;
  end: Date;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  until: Date;
}): OccurrenceWindow[] {
  const { start, end, frequency, interval, weekdays, until } = params;
  const duration = end.getTime() - start.getTime();
  const windows: OccurrenceWindow[] = [];

  if (frequency === "daily" || frequency === "weekly") {
    const stepMs = frequency === "daily" ? interval * DAY_MS : interval * 7 * DAY_MS;
    for (
      let cursor = new Date(start), idx = 0;
      cursor.getTime() <= until.getTime() && idx < MAX_RECURRING_OCCURRENCES;
      cursor = new Date(cursor.getTime() + stepMs), idx += 1
    ) {
      windows.push({ start: new Date(cursor), end: new Date(cursor.getTime() + duration), index: idx });
    }
    return windows;
  }

  // Custom weekly recurrence: every N weeks on selected weekdays.
  const startDayAnchor = normalizeMidnightUtc(start);
  let idx = 0;
  for (
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    cursor.getTime() <= until.getTime() && idx < MAX_RECURRING_OCCURRENCES;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const weeksSinceStart = Math.floor((normalizeMidnightUtc(cursor) - startDayAnchor) / (7 * DAY_MS));
    if (weeksSinceStart < 0 || weeksSinceStart % interval !== 0) continue;
    if (!weekdays.includes(cursor.getUTCDay())) continue;

    const startAt = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
        start.getUTCHours(),
        start.getUTCMinutes(),
        start.getUTCSeconds(),
        start.getUTCMilliseconds()
      )
    );
    if (startAt.getTime() < start.getTime()) continue;

    windows.push({
      start: startAt,
      end: new Date(startAt.getTime() + duration),
      index: idx,
    });
    idx += 1;
  }
  return windows;
}

export async function POST(request: Request) {
  const form = await request.formData();

  const eventId = randomUUID();
  const eventName = form.get("eventName")?.toString() ?? "";
  const categoryId = form.get("categoryId")?.toString() ?? "";
  const description = form.get("description")?.toString() ?? null;
  const startDate = form.get("startDate")?.toString() ?? "";
  const endDate = form.get("endDate")?.toString() ?? "";
  const location = form.get("location")?.toString() ?? "";
  const latitude = form.get("latitude")?.toString() ?? "";
  const longitude = form.get("longitude")?.toString() ?? "";
  const capacity = form.get("capacity")?.toString();
  const price = form.get("price")?.toString();
  const userId = form.get("userId")?.toString() ?? "";
  const image = form.get("image") as File | null;
  const recurrenceEnabled = form.get("recurrenceEnabled")?.toString() === "true";
  const recurrenceFrequency = (form.get("recurrenceFrequency")?.toString() ?? "weekly") as RecurrenceFrequency;
  const recurrenceIntervalRaw = form.get("recurrenceInterval")?.toString() ?? "1";
  const recurrenceUntilRaw = form.get("recurrenceUntil")?.toString() ?? "";
  const recurrenceWeekdaysRaw = form.get("recurrenceWeekdays")?.toString() ?? "";

  if (!eventName || !categoryId || !startDate || !endDate || !location || !latitude || !longitude || !userId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const startAt = toDate(startDate);
  const endAt = toDate(endDate);
  if (!startAt || !endAt) {
    return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
  }
  if (endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  let pictureUrl: string | null = null;

  try {
    if (image) {
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Image too large (max 6MB)" }, { status: 400 });
      }
      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
      }

      const ext = image.type.split("/")[1] || "jpg";
      pictureUrl = await uploadEventImageUnified(eventId, { buffer, mimeType: image.type, ext });
    }

    if (!recurrenceEnabled) {
      const event = await prisma.event.create({
        data: {
          eventId,
          eventName,
          categoryId,
          description,
          eventDatetime: startAt,
          eventEndtime: endAt,
          eventLocation: `${location}!longitude=${longitude}&latitude=${latitude}`,
          pictureUrl,
          capacity: capacity ? parseInt(capacity, 10) : null,
          priceField: price ? parseInt(price, 10) : null,
          userId,
        },
      });
      return NextResponse.json({ event }, { status: 201 });
    }

    const interval = Math.max(1, parseInt(recurrenceIntervalRaw, 10) || 1);
    const until = toDate(recurrenceUntilRaw);
    if (!until) {
      return NextResponse.json({ error: "Recurrence end date is required" }, { status: 400 });
    }
    if (until.getTime() < startAt.getTime()) {
      return NextResponse.json({ error: "Recurrence end must be after the start date" }, { status: 400 });
    }
    const validFrequencies: RecurrenceFrequency[] = ["daily", "weekly", "custom"];
    if (!validFrequencies.includes(recurrenceFrequency)) {
      return NextResponse.json({ error: "Invalid recurrence frequency" }, { status: 400 });
    }
    const weekdays = recurrenceWeekdaysRaw
      .split(",")
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
    if (recurrenceFrequency === "custom" && weekdays.length === 0) {
      return NextResponse.json({ error: "Choose at least one weekday for custom recurrence" }, { status: 400 });
    }

    const windows = buildRecurringWindows({
      start: startAt,
      end: endAt,
      frequency: recurrenceFrequency,
      interval,
      weekdays,
      until,
    });

    if (windows.length === 0) {
      return NextResponse.json({ error: "No valid occurrences generated for that recurrence setup" }, { status: 400 });
    }

    const seriesId = randomUUID();
    const recurrenceWeekdays = recurrenceFrequency === "custom" ? weekdays.join(",") : null;
    const masterEventId = randomUUID();
    const rows = windows.map((window, index) => ({
      eventId: index === 0 ? masterEventId : randomUUID(),
      eventName,
      categoryId,
      description,
      eventDatetime: window.start,
      eventEndtime: window.end,
      eventLocation: `${location}!longitude=${longitude}&latitude=${latitude}`,
      pictureUrl,
      capacity: capacity ? parseInt(capacity, 10) : null,
      priceField: price ? parseInt(price, 10) : null,
      userId,
      seriesId,
      isRecurring: true,
      recurrenceKind: recurrenceFrequency,
      recurrenceInterval: interval,
      recurrenceWeekdays,
      recurrenceUntil: until,
      occurrenceIndex: window.index,
      isSeriesMaster: index === 0,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.event.createMany({ data: rows });
    });

    const event = await prisma.event.findUnique({ where: { eventId: masterEventId } });
    return NextResponse.json({ event, createdOccurrences: rows.length, seriesId }, { status: 201 });
  } catch (error) {
    console.error("Create event failed", error);
    const message = error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
