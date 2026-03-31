import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  pitchIdParamSchema,
  pitchScheduleCreateSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { createPitchSchedule } from "@/services/pitches";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(pitchIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid pitch id");
  }

  const parsedBody = await parseJsonBody(pitchScheduleCreateSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid pitch schedule");
  }

  try {
    const schedule = await createPitchSchedule({
      ownerId: sessionCheck.user!.id,
      pitchId: parsedParams.data.id,
      ...parsedBody.data,
    });
    revalidatePath("/host");
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create pitch schedule", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
