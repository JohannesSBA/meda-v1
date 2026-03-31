import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { formatUnknownError } from "@/lib/apiResponse";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import {
  pitchIdParamSchema,
  pitchPatchSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { getPitchByIdForOwner, updatePitch } from "@/services/pitches";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(pitchIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid pitch id");
  }

  try {
    const pitch = await getPitchByIdForOwner(
      sessionCheck.user!.id,
      parsedParams.data.id,
    );
    return NextResponse.json({ pitch }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load pitch", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 404 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(pitchIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid pitch id");
  }

  const parsedBody = await parseJsonBody(pitchPatchSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid pitch update");
  }

  try {
    const pitch = await updatePitch({
      ownerId: sessionCheck.user!.id,
      pitchId: parsedParams.data.id,
      ...parsedBody.data,
    });
    revalidatePath("/host");
    return NextResponse.json({ pitch }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update pitch", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
