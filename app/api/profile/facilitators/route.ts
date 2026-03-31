import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  facilitatorCreateSchema,
} from "@/lib/validations/profile";
import {
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/validations/http";
import {
  createFacilitator,
  listFacilitatorsForPitchOwner,
} from "@/services/facilitator";

export async function GET() {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const facilitators = await listFacilitatorsForPitchOwner(
      sessionCheck.user!.id,
    );
    return NextResponse.json({ facilitators }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load facilitators", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(facilitatorCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid facilitator payload");
  }

  try {
    const facilitator = await createFacilitator({
      pitchOwnerUserId: sessionCheck.user!.id,
      email: parsed.data.email,
    });
    return NextResponse.json({ facilitator }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create facilitator", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
