import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { createEvent } from "@/services/events";

export async function POST(request: Request) {
  const rl = await checkRateLimit(`create-event:${getClientId(request)}`, 5, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before creating another event." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;
  const userId = session.user.id;

  const form = await request.formData();
  const eventName = form.get("eventName")?.toString() ?? "";
  const categoryId = form.get("categoryId")?.toString() ?? "";
  const description = form.get("description")?.toString() ?? null;
  const startDate = form.get("startDate")?.toString() ?? "";
  const endDate = form.get("endDate")?.toString() ?? "";
  const location = form.get("location")?.toString() ?? "";
  const latitude = form.get("latitude")?.toString() ?? "";
  const longitude = form.get("longitude")?.toString() ?? "";
  const capacityRaw = form.get("capacity")?.toString();
  const priceRaw = form.get("price")?.toString();
  const image = form.get("image") as File | null;
  const recurrenceEnabled = form.get("recurrenceEnabled")?.toString() === "true";
  const recurrenceFrequency = (form.get("recurrenceFrequency")?.toString() ?? "weekly") as "daily" | "weekly" | "custom";
  const recurrenceIntervalRaw = form.get("recurrenceInterval")?.toString() ?? "1";
  const recurrenceUntil = form.get("recurrenceUntil")?.toString() ?? "";
  const recurrenceWeekdays = form.get("recurrenceWeekdays")?.toString() ?? "";

  let imageData: { buffer: Buffer; mimeType: string; ext: string } | null = null;
  if (image && image.size > 0) {
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = image.type.split("/")[1] || "jpg";
    imageData = { buffer, mimeType: image.type, ext };
  }

  const capacityParsed = capacityRaw ? parseInt(capacityRaw, 10) : null;
  const priceParsed = priceRaw ? parseInt(priceRaw, 10) : null;
  const capacity = capacityParsed != null && !Number.isNaN(capacityParsed) ? capacityParsed : null;
  const price = priceParsed != null && !Number.isNaN(priceParsed) ? priceParsed : null;

  try {
    const result = await createEvent({
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
      image: imageData,
      recurrenceEnabled,
      recurrenceFrequency,
      recurrenceInterval: Math.max(1, parseInt(recurrenceIntervalRaw, 10) || 1),
      recurrenceUntil,
      recurrenceWeekdays,
    });

    if (result.createdOccurrences != null) {
      return NextResponse.json(
        { event: result.event, createdOccurrences: result.createdOccurrences, seriesId: result.seriesId },
        { status: 201 },
      );
    }
    return NextResponse.json({ event: result.event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create event";
    const isValidationError =
      message.includes("Missing required") ||
      message.includes("Invalid") ||
      message.includes("Capacity") ||
      message.includes("Price") ||
      message.includes("Recurrence") ||
      message.includes("Image") ||
      message.includes("End time") ||
      message.includes("start time") ||
      message.includes("date") ||
      message.includes("weekday") ||
      message.includes("occurrences");
    if (isValidationError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    logger.error("Create event failed", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
