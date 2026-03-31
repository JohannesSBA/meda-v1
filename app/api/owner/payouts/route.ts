import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { createPitchOwnerPayoutSchema } from "@/lib/validations/payments";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import {
  createPitchOwnerPayout,
  getPitchOwnerPayoutSummary,
} from "@/services/payouts";

export async function GET() {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const data = await getPitchOwnerPayoutSummary(sessionCheck.user!.id);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    logger.error("Failed to load owner payout summary", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(createPitchOwnerPayoutSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payout request");
  }

  try {
    const origin = new URL(request.url).origin;
    const payout = await createPitchOwnerPayout({
      ownerId: sessionCheck.user!.id,
      amountEtb: parsed.data.amountEtb ?? null,
      initiatedByUserId: sessionCheck.user!.id,
      callbackUrl: `${origin}/api/payouts/chapa/callback`,
    });
    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create owner payout", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
