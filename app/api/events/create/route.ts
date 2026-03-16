import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminOrPitchOwnerUser } from "@/lib/auth/guards";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createEvent } from "@/services/events";
import {
  initializeEventCreationCheckout,
  recordWaivedEventCreation,
} from "@/services/eventCreationFee";
import { createEventFormSchema } from "@/lib/validations/events";
import { parseFormData, validationErrorResponse } from "@/lib/validations/http";
import { revalidateAdminStats, revalidateEventData } from "@/lib/revalidation";
import { uploadEventImageUnified } from "@/lib/uploadEventImage";

export async function POST(request: Request) {
  const rl = await checkRateLimit(`create-event:${getClientId(request)}`, 5, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before creating another event." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const session = await requireAdminOrPitchOwnerUser();
  if (!session.user || session.response) return session.response!;
  const userId = session.user.id;

  if (session.user.role === "pitch_owner") {
    const payoutProfile = await prisma.pitchOwnerProfile.findUnique({
      where: { userId },
      select: {
        chapaSubaccountId: true,
        payoutSetupVerifiedAt: true,
      },
    });

    if (!payoutProfile?.chapaSubaccountId || !payoutProfile.payoutSetupVerifiedAt) {
      return NextResponse.json(
        { error: "Complete payout setup before creating events." },
        { status: 403 },
      );
    }
  }

  const parsed = await parseFormData(createEventFormSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event payload");
  }

  const {
    eventName,
    categoryId,
    promoCode,
    description,
    startDate,
    endDate,
    location,
    latitude,
    longitude,
    capacity,
    price,
    image,
    recurrenceEnabled,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceUntil,
    recurrenceWeekdays,
  } = parsed.data;

  let imageData: { buffer: Buffer; mimeType: string; ext: string } | null = null;
  if (image && image.size > 0) {
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = image.type.split("/")[1] || "jpg";
    imageData = { buffer, mimeType: image.type, ext };
  }

  let pictureUrl: string | null = null;
  if (imageData) {
    pictureUrl = await uploadEventImageUnified(randomUUID(), imageData);
  }

  const eventPayload = {
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
    pictureUrl,
    recurrenceEnabled,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceUntil,
    recurrenceWeekdays,
  };

  try {
    if (session.user.role === "pitch_owner") {
      const baseUrl = new URL(request.url).origin;
      const callbackUrl =
        process.env.CHAPA_CALLBACK_URL ??
        `${baseUrl}/api/payments/chapa/callback`;
      const result = await initializeEventCreationCheckout({
        pitchOwnerUserId: userId,
        email: session.user.email ?? `user-${session.user.id}@meda.app`,
        firstName: session.user.name?.split(" ").at(0),
        lastName: session.user.name?.split(" ").slice(1).join(" ") || undefined,
        callbackUrl,
        returnUrlBase: `${baseUrl}/create-events/status`,
        promoCode,
        eventPayload,
      });

      if (result.kind === "checkout") {
        return NextResponse.json(
          {
            checkoutUrl: result.checkoutUrl,
            txRef: result.txRef,
            quote: result.quote,
          },
          { status: 202 },
        );
      }

      const createdEvent = await createEvent({
        ...eventPayload,
        image: null,
      });
      await recordWaivedEventCreation({
        pitchOwnerUserId: userId,
        eventId: createdEvent.event.eventId,
        quote: result.quote,
      });

      revalidateEventData(createdEvent.event.eventId, [userId]);
      revalidateAdminStats();

      if (createdEvent.createdOccurrences != null) {
        return NextResponse.json(
          {
            event: createdEvent.event,
            createdOccurrences: createdEvent.createdOccurrences,
            seriesId: createdEvent.seriesId,
          },
          { status: 201 },
        );
      }

      return NextResponse.json({ event: createdEvent.event }, { status: 201 });
    }

    const result = await createEvent({
      ...eventPayload,
      image: null,
    });

    revalidateEventData(result.event.eventId, [userId]);
    revalidateAdminStats();

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
