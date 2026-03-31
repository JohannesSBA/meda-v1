import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  partyIdParamSchema,
  partyInviteSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { invitePartyMembers } from "@/services/parties";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(partyIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid party id");
  }
  const parsedBody = await parseJsonBody(partyInviteSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid invite payload");
  }

  try {
    const party = await invitePartyMembers({
      partyId: parsedParams.data.id,
      ownerId: sessionCheck.user!.id,
      emails: parsedBody.data.emails,
    });
    revalidatePath("/tickets");
    revalidatePath("/host");
    return NextResponse.json({ party }, { status: 200 });
  } catch (error) {
    logger.error("Failed to invite party members", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
