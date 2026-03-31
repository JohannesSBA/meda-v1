import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  partyIdParamSchema,
  ticketIdParamSchema,
} from "@/lib/validations/bookingInventory";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { removePartyMember } from "@/services/parties";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const rawParams = await context.params;
  const parsedPartyId = parseParams(partyIdParamSchema, { id: rawParams.id });
  if (!parsedPartyId.success) {
    return validationErrorResponse(parsedPartyId.error, "Invalid party id");
  }
  const parsedMemberId = parseParams(ticketIdParamSchema, { id: rawParams.memberId });
  if (!parsedMemberId.success) {
    return validationErrorResponse(parsedMemberId.error, "Invalid member id");
  }

  try {
    const party = await removePartyMember({
      partyId: parsedPartyId.data.id,
      ownerId: sessionCheck.user!.id,
      memberId: parsedMemberId.data.id,
    });
    revalidatePath("/tickets");
    revalidatePath("/host");
    return NextResponse.json({ party }, { status: 200 });
  } catch (error) {
    logger.error("Failed to remove party member", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
