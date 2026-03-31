import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { pitchCreateSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { createPitch, listOwnerPitches } from "@/services/pitches";

export async function GET() {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const pitches = await listOwnerPitches(sessionCheck.user!.id);
    return NextResponse.json({ pitches }, { status: 200 });
  } catch (error) {
    logger.error("Failed to list owner pitches", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(pitchCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid pitch payload");
  }

  try {
    const pitch = await createPitch({
      ownerId: sessionCheck.user!.id,
      ...parsed.data,
    });
    revalidatePath("/host");
    return NextResponse.json({ pitch }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create pitch", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
