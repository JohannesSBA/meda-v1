import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { partyIdParamSchema } from "@/lib/validations/bookingInventory";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { joinParty } from "@/services/parties";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = parseParams(partyIdParamSchema, await context.params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid party id");
  }

  try {
    const party = await joinParty({
      partyId: parsed.data.id,
      userId: sessionCheck.user!.id,
      userEmail: sessionCheck.user!.email ?? null,
    });
    return NextResponse.json({ party }, { status: 200 });
  } catch (error) {
    logger.error("Failed to join party", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
