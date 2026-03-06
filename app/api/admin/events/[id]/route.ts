import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireAdminUser } from "@/lib/auth/guards";
import { uploadEventImageUnified } from "@/lib/uploadEventImage";
import { promoteWaitlistForEvent } from "@/services/waitlistPromotion";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { eventId: id },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const seriesCount =
    event.seriesId != null
      ? await prisma.event.count({ where: { seriesId: event.seriesId } })
      : 1;

  const decoded = decodeEventLocation(event.eventLocation);
  return NextResponse.json(
    {
      seriesCount,
      event: {
        ...event,
        eventDatetime: event.eventDatetime.toISOString(),
        eventEndtime: event.eventEndtime.toISOString(),
        recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        addressLabel: decoded.addressLabel,
        latitude: decoded.latitude,
        longitude: decoded.longitude,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;
  const { id } = await params;

  const contentType = request.headers.get("content-type") ?? "";
  let payload:
    | {
        eventName?: string;
        description?: string | null;
        pictureUrl?: string | null;
        eventDatetime?: string;
        eventEndtime?: string;
        eventLocation?: string | null;
        capacity?: number | null;
        priceField?: number | null;
        categoryId?: string;
        applyToSeries?: boolean;
      }
    | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const image = form.get("image");
    let pictureUrl: string | null | undefined = form.get("pictureUrl")?.toString();
    if (image && image instanceof File && image.size > 0) {
      const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!ALLOWED_MIME_TYPES.includes(image.type)) {
        return NextResponse.json({ error: "Invalid file type. Allowed: JPEG, PNG, GIF, WEBP" }, { status: 400 });
      }
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = image.type.split("/")[1] || "jpg";
      pictureUrl = await uploadEventImageUnified(id, {
        buffer,
        mimeType: image.type,
        ext,
      });
    }
    const rawCapacity = form.get("capacity")?.toString();
    const rawPrice = form.get("price")?.toString();
    const parsedCapacity = rawCapacity ? Number(rawCapacity) : null;
    const parsedPrice = rawPrice ? Number(rawPrice) : null;

    if (parsedCapacity !== null && (Number.isNaN(parsedCapacity) || parsedCapacity < 0)) {
      return NextResponse.json({ error: "Capacity must be a non-negative number" }, { status: 400 });
    }
    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 });
    }

    payload = {
      eventName: form.get("eventName")?.toString(),
      description: form.get("description")?.toString() ?? null,
      pictureUrl: pictureUrl ?? undefined,
      eventDatetime: form.get("startDate")?.toString(),
      eventEndtime: form.get("endDate")?.toString(),
      eventLocation:
        form.get("location") && form.get("latitude") && form.get("longitude")
          ? `${form.get("location")?.toString()}!longitude=${form.get("longitude")?.toString()}&latitude=${form.get("latitude")?.toString()}`
          : form.get("eventLocation")?.toString(),
      capacity: parsedCapacity,
      priceField: parsedPrice,
      categoryId: form.get("categoryId")?.toString(),
      applyToSeries: form.get("applyToSeries")?.toString() === "true",
    };
  } else {
    payload = (await request.json().catch(() => null)) as
      | {
          eventName?: string;
          description?: string | null;
          pictureUrl?: string | null;
          eventDatetime?: string;
          eventEndtime?: string;
          eventLocation?: string | null;
          capacity?: number | null;
          priceField?: number | null;
          categoryId?: string;
          applyToSeries?: boolean;
        }
      | null;
  }

  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.event.findUnique({ where: { eventId: id } });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const start =
    payload.eventDatetime != null ? new Date(payload.eventDatetime) : existing.eventDatetime;
  const end =
    payload.eventEndtime != null ? new Date(payload.eventEndtime) : existing.eventEndtime;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid event date/time" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: "Event end must be after start" }, { status: 400 });
  }

  const updateData = {
    eventName: payload.eventName ?? existing.eventName,
    description: payload.description ?? existing.description,
    pictureUrl: payload.pictureUrl ?? existing.pictureUrl,
    eventDatetime: start,
    eventEndtime: end,
    eventLocation: payload.eventLocation ?? existing.eventLocation,
    capacity: payload.capacity ?? existing.capacity,
    priceField: payload.priceField ?? existing.priceField,
    categoryId: payload.categoryId ?? existing.categoryId,
    updatedAt: new Date(),
  };

  if (payload.applyToSeries && existing.seriesId) {
    const updatedMany = await prisma.event.updateMany({
      where: { seriesId: existing.seriesId },
      data: updateData,
    });

    const refreshed = await prisma.event.findUnique({ where: { eventId: id } });
    if (!refreshed) {
      return NextResponse.json({ error: "Event not found after update" }, { status: 404 });
    }

    if (
      payload.capacity != null &&
      payload.capacity > 0
    ) {
      const seriesEvents = await prisma.event.findMany({
        where: { seriesId: existing.seriesId },
        select: { eventId: true },
      });
      for (const e of seriesEvents) {
        void promoteWaitlistForEvent(e.eventId);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        bulkUpdated: true,
        updatedCount: updatedMany.count,
        event: {
          ...refreshed,
          eventDatetime: refreshed.eventDatetime.toISOString(),
          eventEndtime: refreshed.eventEndtime.toISOString(),
          updatedAt: refreshed.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  }

  const updated = await prisma.event.update({
    where: { eventId: id },
    data: updateData,
  });

  if (payload.capacity != null && payload.capacity > 0) {
    void promoteWaitlistForEvent(id);
  }

  return NextResponse.json(
    {
      ok: true,
      event: {
        ...updated,
        eventDatetime: updated.eventDatetime.toISOString(),
        eventEndtime: updated.eventEndtime.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    },
    { status: 200 }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { eventId: id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.event.delete({ where: { eventId: id } });
  return NextResponse.json({ ok: true });
}
