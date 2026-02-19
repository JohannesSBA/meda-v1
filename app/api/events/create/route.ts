import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { uploadEventImageUnified } from "@/lib/uploadEventImage";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB per supabase guidance

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

  if (!eventName || !categoryId || !startDate || !endDate || !location || !latitude || !longitude || !userId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    const event = await prisma.event.create({
      data: {
        eventId,
        eventName,
        categoryId,
        description,
        eventDatetime: new Date(startDate),
        eventEndtime: new Date(endDate),
        eventLocation: `${location}!longitude=${longitude}&latitude=${latitude}`,
        pictureUrl,
        capacity: capacity ? parseInt(capacity) : null,
        priceField: price ? parseInt(price) : null,
        userId,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Create event failed", error);
    const message = error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
