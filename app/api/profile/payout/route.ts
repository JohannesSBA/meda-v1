import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { payoutSettingsSchema } from "@/lib/validations/profile";
import {
  getPitchOwnerPayoutSettings,
  updatePitchOwnerPayoutSettings,
} from "@/services/pitchOwner";
import {
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/validations/http";

export async function GET() {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const payout = await getPitchOwnerPayoutSettings(sessionCheck.user!.id);
    return NextResponse.json({ payout }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load pitch owner payout settings", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(payoutSettingsSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payout settings");
  }

  try {
    const payout = await updatePitchOwnerPayoutSettings({
      userId: sessionCheck.user!.id,
      ...parsed.data,
    });
    revalidatePath("/profile");
    revalidatePath("/create-events");
    return NextResponse.json({ payout }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update pitch owner payout settings", error);
    const message = formatUnknownError(error);
    return NextResponse.json(
      { error: message },
      { status: message.includes("Chapa") ? 502 : 400 },
    );
  }
}
