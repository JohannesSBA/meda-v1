import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { partyCreateSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { createParty, listPartiesForUser } from "@/services/parties";

export async function GET() {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const parties = await listPartiesForUser({
      userId: sessionCheck.user!.id,
      userEmail: sessionCheck.user!.email ?? null,
    });
    return NextResponse.json({ parties }, { status: 200 });
  } catch (error) {
    logger.error("Failed to list parties", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(partyCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid party payload");
  }

  try {
    const party = await createParty({
      ownerId: sessionCheck.user!.id,
      name: parsed.data.name,
    });
    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create party", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
