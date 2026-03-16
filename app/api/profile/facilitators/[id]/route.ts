import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { uuidSchema } from "@/lib/validations/events";
import {
  facilitatorPatchSchema,
} from "@/lib/validations/profile";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { updateFacilitator } from "@/services/facilitator";

const facilitatorIdParamSchema = uuidSchema.transform((id) => ({ id }));

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(facilitatorIdParamSchema, (await params).id);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid facilitator id");
  }

  const parsedBody = await parseJsonBody(facilitatorPatchSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid facilitator update");
  }

  try {
    const facilitator = await updateFacilitator({
      id: parsedParams.data.id,
      pitchOwnerUserId: sessionCheck.user!.id,
      isActive: parsedBody.data.isActive,
    });
    return NextResponse.json({ facilitator }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update facilitator", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
