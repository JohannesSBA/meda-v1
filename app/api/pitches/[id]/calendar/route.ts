import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  ownerCalendarQuerySchema,
  pitchIdParamSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseParams,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { getOwnerCalendar } from "@/services/calendar";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(pitchIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid pitch id");
  }

  const parsedQuery = parseSearchParams(
    ownerCalendarQuerySchema,
    new URL(request.url).searchParams,
  );
  if (!parsedQuery.success) {
    return validationErrorResponse(parsedQuery.error, "Invalid calendar query");
  }

  try {
    const calendar = await getOwnerCalendar({
      ownerId: sessionCheck.user!.id,
      pitchId: parsedParams.data.id,
      view: parsedQuery.data.view,
      from: new Date(parsedQuery.data.from),
      to: new Date(parsedQuery.data.to),
    });
    return NextResponse.json(calendar, { status: 200 });
  } catch (error) {
    logger.error("Failed to load pitch calendar", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
