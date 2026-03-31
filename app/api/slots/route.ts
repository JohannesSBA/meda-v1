import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  slotCreateSchema,
  slotListQuerySchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { getOwnerCalendar } from "@/services/calendar";
import { createSlot, listOwnerSlots, listPublicSlots } from "@/services/slots";

export async function GET(request: Request) {
  const parsed = parseSearchParams(slotListQuerySchema, new URL(request.url).searchParams);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid slot query");
  }

  try {
    const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
    const to = parsed.data.to ? new Date(parsed.data.to) : undefined;

    if (parsed.data.ownerView) {
      const sessionCheck = await requirePitchOwnerUser();
      if (sessionCheck.response) return sessionCheck.response;

      if (from && to) {
        const calendar = await getOwnerCalendar({
          ownerId: sessionCheck.user!.id,
          from,
          to,
          view: parsed.data.view,
          pitchId: parsed.data.pitchId,
        });
        return NextResponse.json(calendar, { status: 200 });
      }

      const slots = await listOwnerSlots({
        ownerId: sessionCheck.user!.id,
        pitchId: parsed.data.pitchId,
        from,
        to,
      });
      return NextResponse.json({ slots }, { status: 200 });
    }

    const slots = await listPublicSlots({
      pitchId: parsed.data.pitchId,
      from,
      to,
    });
    return NextResponse.json({ slots }, { status: 200 });
  } catch (error) {
    logger.error("Failed to list slots", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(slotCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid slot payload");
  }

  try {
    const result = await createSlot({
      ownerId: sessionCheck.user!.id,
      ...parsed.data,
    });
    revalidatePath("/host");
    revalidatePath("/play");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error("Failed to create slot", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
