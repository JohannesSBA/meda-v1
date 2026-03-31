import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  slotIdParamSchema,
  slotPatchSchema,
} from "@/lib/validations/bookingInventory";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import {
  deleteSlot,
  getPublicSlotById,
  updateSlot,
} from "@/services/slots";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsedParams = parseParams(slotIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid slot id");
  }

  try {
    const slot = await getPublicSlotById(parsedParams.data.id);
    return NextResponse.json({ slot }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load slot", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 404 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(slotIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid slot id");
  }

  const parsedBody = await parseJsonBody(slotPatchSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid slot update");
  }

  try {
    const slot = await updateSlot({
      ownerId: sessionCheck.user!.id,
      slotId: parsedParams.data.id,
      ...parsedBody.data,
    });
    revalidatePath("/host");
    revalidatePath("/play");
    return NextResponse.json({ slot }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update slot", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(slotIdParamSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid slot id");
  }

  try {
    await deleteSlot({
      ownerId: sessionCheck.user!.id,
      slotId: parsedParams.data.id,
    });
    revalidatePath("/host");
    revalidatePath("/play");
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error("Failed to delete slot", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
