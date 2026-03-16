import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  adminEventCreationFeeSchema,
} from "@/lib/validations/admin";
import {
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/validations/http";
import {
  getCurrentEventCreationFee,
  setEventCreationFeeAmount,
} from "@/services/eventCreationFee";

export async function GET() {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  try {
    const fee = await getCurrentEventCreationFee();
    return NextResponse.json({ fee }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load event creation fee", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const parsed = await parseJsonBody(adminEventCreationFeeSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event creation fee");
  }

  try {
    const fee = await setEventCreationFeeAmount(parsed.data.amountEtb);
    return NextResponse.json({ fee }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update event creation fee", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
