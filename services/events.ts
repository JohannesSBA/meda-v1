/**
 * Events service -- event creation (single and recurring).
 *
 * Handles validation, image upload, recurrence window generation, and Prisma writes.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { uploadEventImageUnified } from "@/lib/uploadEventImage";
import { logger } from "@/lib/logger";
import { prepareEventLocationFields } from "@/lib/location";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB per supabase guidance
const MAX_RECURRING_OCCURRENCES = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

type RecurrenceFrequency = "daily" | "weekly" | "custom";

type OccurrenceWindow = {
  start: Date;
  end: Date;
  index: number;
};

export type CreateEventParams = {
  userId: string;
  eventName: string;
  categoryId: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string;
  latitude: string;
  longitude: string;
  capacity: number | null;
  price: number | null;
  image?: { buffer: Buffer; mimeType: string; ext: string } | null;
  pictureUrl?: string | null;
  recurrenceEnabled: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceUntil?: string;
  recurrenceWeekdays?: string;
};

export type CreateEventResult =
  | { event: { eventId: string; [key: string]: unknown }; createdOccurrences?: never; seriesId?: never }
  | { event: { eventId: string; [key: string]: unknown }; createdOccurrences: number; seriesId: string };

type EventWriter = Pick<typeof prisma, "event">;

function toDate(value: string): Date | null {
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

export async function createEventWithClient(
  db: EventWriter,
  params: CreateEventParams,
): Promise<CreateEventResult> {
  const {
    userId,
    eventName,
    categoryId,
    description,
    startDate,
    endDate,
    location,
    latitude,
    longitude,
    capacity,
    price,
    image,
    pictureUrl: initialPictureUrl,
    recurrenceEnabled,
    recurrenceFrequency = "weekly",
    recurrenceInterval = 1,
    recurrenceUntil,
    recurrenceWeekdays = "",
  } = params;

  if (!eventName || !categoryId || !startDate || !endDate || !location || !latitude || !longitude) {
    throw new Error("Missing required fields");
  }

  const startAt = toDate(startDate);
  const endAt = toDate(endDate);
  if (!startAt || !endAt) {
    throw new Error("Invalid start/end date");
  }
  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error("End time must be after start time");
  }

  const capacityNum = capacity;
  if (capacityNum !== null && (Number.isNaN(capacityNum) || capacityNum < 1)) {
    throw new Error("Capacity must be a positive integer");
  }
  const priceNum = price;
  if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) {
    throw new Error("Price must be a non-negative integer");
  }

  let pictureUrl: string | null = initialPictureUrl ?? null;
  const eventId = randomUUID();

  if (image) {
    if (image.buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Image too large (max 6MB)");
    }
    if (!ALLOWED_MIME_TYPES.includes(image.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new Error("Invalid file type. Allowed: JPEG, PNG, GIF, WEBP");
    }
    pictureUrl = await uploadEventImageUnified(eventId, {
      buffer: image.buffer,
      mimeType: image.mimeType,
      ext: image.ext,
    });
  }

  const locationFields = prepareEventLocationFields({
    addressLabel: location,
    latitude,
    longitude,
  });

  if (!recurrenceEnabled) {
    const event = await db.event.create({
      data: {
        eventId,
        eventName,
        categoryId,
        description,
        eventDatetime: startAt,
        eventEndtime: endAt,
        eventLocation: locationFields.eventLocation,
        addressLabel: locationFields.addressLabel,
        latitude: locationFields.latitude,
        longitude: locationFields.longitude,
        pictureUrl,
        capacity: capacityNum,
        priceField: priceNum,
        userId,
      },
    });
    return { event };
  }

  const interval = Math.max(1, recurrenceInterval);
  const until = toDate(recurrenceUntil ?? "");
  if (!until) {
    throw new Error("Recurrence end date is required");
  }
  if (until.getTime() < startAt.getTime()) {
    throw new Error("Recurrence end must be after the start date");
  }
  const validFrequencies: RecurrenceFrequency[] = ["daily", "weekly", "custom"];
  if (!validFrequencies.includes(recurrenceFrequency)) {
    throw new Error("Invalid recurrence frequency");
  }
  const weekdays = recurrenceWeekdays
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  if (recurrenceFrequency === "custom" && weekdays.length === 0) {
    throw new Error("Choose at least one weekday for custom recurrence");
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
    throw new Error("No valid occurrences generated for that recurrence setup");
  }

  const seriesId = randomUUID();
  const recurrenceWeekdaysDb = recurrenceFrequency === "custom" ? weekdays.join(",") : null;
  const masterEventId = randomUUID();
  const rows = windows.map((window, index) => ({
    eventId: index === 0 ? masterEventId : randomUUID(),
    eventName,
    categoryId,
    description,
    eventDatetime: window.start,
    eventEndtime: window.end,
    eventLocation: locationFields.eventLocation,
    addressLabel: locationFields.addressLabel,
    latitude: locationFields.latitude,
    longitude: locationFields.longitude,
    pictureUrl,
    capacity: capacityNum,
    priceField: priceNum,
    userId,
    seriesId,
    isRecurring: true,
    recurrenceKind: recurrenceFrequency,
    recurrenceInterval: interval,
    recurrenceWeekdays: recurrenceWeekdaysDb,
    recurrenceUntil: until,
    occurrenceIndex: window.index,
    isSeriesMaster: index === 0,
  }));

  await db.event.createMany({ data: rows });

  const event = await db.event.findUnique({ where: { eventId: masterEventId } });
  if (!event) {
    logger.error("Create event: master event not found after createMany");
    throw new Error("Failed to create event");
  }

  return { event, createdOccurrences: rows.length, seriesId };
}

export async function createEvent(params: CreateEventParams): Promise<CreateEventResult> {
  return createEventWithClient(prisma, params);
}
