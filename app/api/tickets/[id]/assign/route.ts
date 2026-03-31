import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  ticketAssignSchema,
  ticketIdParamSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { assignTicket } from "@/services/ticketAssignments";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(ticketIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid ticket id");
  }
  const parsedBody = await parseJsonBody(ticketAssignSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid ticket assignment payload");
  }

  try {
    const ticket = await assignTicket({
      ticketId: parsedParams.data.id,
      actor: {
        userId: sessionCheck.user!.id,
        role: sessionCheck.user!.role ?? null,
        email: sessionCheck.user!.email ?? null,
        parentPitchOwnerUserId: sessionCheck.user!.parentPitchOwnerUserId ?? null,
      },
      assignedUserId: parsedBody.data.assignedUserId,
      assignedEmail: parsedBody.data.assignedEmail,
      assignedName: parsedBody.data.assignedName,
    });
    revalidatePath("/tickets");
    revalidatePath("/host");
    return NextResponse.json({ ticket }, { status: 200 });
  } catch (error) {
    logger.error("Failed to assign ticket", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
