import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { uploadEventImageUnified } from "@/lib/uploadEventImage";
import {
  parseFormData,
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import {
  adminEventIdParamSchema,
  adminEventPatchFormSchema,
  adminEventPatchJsonSchema,
} from "@/lib/validations/admin";
import type { AdminEventPatchInput } from "@/services/adminEvents";
import {
  deleteAdminEvent,
  getAdminEventDetail,
  updateAdminEvent,
} from "@/services/adminEvents";
import { revalidateAdminStats, revalidateEventData } from "@/lib/revalidation";

async function parsePatchPayload(
  request: Request,
  eventId: string,
): Promise<AdminEventPatchInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    const parsed = await parseJsonBody(adminEventPatchJsonSchema, request);
    if (!parsed.success) {
      throw parsed.error;
    }
    return parsed.data;
  }

  const parsed = await parseFormData(adminEventPatchFormSchema, request);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { data } = parsed;
  let pictureUrl = data.pictureUrl;
  const image = data.image;

  if (image && image instanceof File && image.size > 0) {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedMimeTypes.includes(image.type)) {
      throw new Error("Invalid file type. Allowed: JPEG, PNG, GIF, WEBP");
    }

    const arrayBuffer = await image.arrayBuffer();
    pictureUrl = await uploadEventImageUnified(eventId, {
      buffer: Buffer.from(arrayBuffer),
      mimeType: image.type,
      ext: image.type.split("/")[1] || "jpg",
    });
  }

  if (data.capacity !== null && Number.isNaN(data.capacity)) {
    throw new Error("Capacity must be a non-negative number");
  }
  if (data.price !== null && Number.isNaN(data.price)) {
    throw new Error("Price must be a non-negative number");
  }

  return {
    eventName: data.eventName,
    description: data.description,
    pictureUrl: pictureUrl ?? undefined,
    eventDatetime: data.startDate,
    eventEndtime: data.endDate,
    eventLocation: data.eventLocation,
    addressLabel: data.location,
    latitude:
      typeof data.latitude === "string" && data.latitude.trim()
        ? Number(data.latitude)
        : undefined,
    longitude:
      typeof data.longitude === "string" && data.longitude.trim()
        ? Number(data.longitude)
        : undefined,
    capacity: data.capacity,
    priceField: data.price,
    categoryId: data.categoryId,
    applyToSeries: data.applyToSeries,
  };
}

function isValidationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "flatten" in error &&
    typeof error.flatten === "function"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const paramParse = parseParams(adminEventIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid event id");
  }

  const result = await getAdminEventDetail(paramParse.data.id);
  if (!result) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const paramParse = parseParams(adminEventIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid event id");
  }

  let payload: AdminEventPatchInput;
  try {
    payload = await parsePatchPayload(request, paramParse.data.id);
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(
        error as Parameters<typeof validationErrorResponse>[0],
        "Invalid payload",
      );
    }
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await updateAdminEvent(paramParse.data.id, payload);
    revalidateEventData(paramParse.data.id);
    revalidateAdminStats();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update event";
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const paramParse = parseParams(adminEventIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid event id");
  }

  try {
    const result = await deleteAdminEvent(paramParse.data.id);
    revalidateEventData(paramParse.data.id);
    revalidateAdminStats();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 400 },
    );
  }
}
