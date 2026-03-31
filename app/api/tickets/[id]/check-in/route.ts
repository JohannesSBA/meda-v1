import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { ticketIdParamSchema } from "@/lib/validations/bookingInventory";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { checkInTicket } from "@/services/ticketAssignments";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(ticketIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid ticket id");
  }

  try {
    const ticket = await checkInTicket({
      ticketId: parsedParams.data.id,
      actor: {
        userId: sessionCheck.user!.id,
        role: sessionCheck.user!.role ?? null,
        email: sessionCheck.user!.email ?? null,
        parentPitchOwnerUserId: sessionCheck.user!.parentPitchOwnerUserId ?? null,
      },
    });
    revalidatePath("/tickets");
    revalidatePath("/host");
    return NextResponse.json({ ticket }, { status: 200 });
  } catch (error) {
    logger.error("Failed to check in ticket", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
