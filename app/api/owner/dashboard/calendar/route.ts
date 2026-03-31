import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  ownerCalendarQuerySchema,
  pitchIdParamSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { getOwnerDashboardCalendar } from "@/services/ownerAnalytics";

export async function GET(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const url = new URL(request.url);
  const parsedRange = parseSearchParams(ownerCalendarQuerySchema, url.searchParams);
  if (!parsedRange.success) {
    return validationErrorResponse(parsedRange.error, "Invalid owner calendar query");
  }

  const rawPitchId = url.searchParams.get("pitchId");
  if (rawPitchId) {
    const parsedPitch = pitchIdParamSchema.safeParse({ id: rawPitchId });
    if (!parsedPitch.success) {
      return validationErrorResponse(parsedPitch.error, "Invalid pitch id");
    }
  }

  try {
    const calendar = await getOwnerDashboardCalendar({
      ownerId: sessionCheck.user!.id,
      pitchId: rawPitchId ?? undefined,
      from: new Date(parsedRange.data.from),
      to: new Date(parsedRange.data.to),
      view: parsedRange.data.view,
    });
    return NextResponse.json(calendar, { status: 200 });
  } catch (error) {
    logger.error("Failed to load owner calendar", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
