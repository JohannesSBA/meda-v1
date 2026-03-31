import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { adminCreatePayoutSchema } from "@/lib/validations/admin";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import {
  createAdminPitchOwnerPayout,
  listAdminPitchOwnerPayoutSummaries,
} from "@/services/payouts";

export async function GET() {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  try {
    const data = await listAdminPitchOwnerPayoutSummaries();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    logger.error("Failed to load admin payouts", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const parsed = await parseJsonBody(adminCreatePayoutSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payout request");
  }

  try {
    const origin = new URL(request.url).origin;
    const payout = await createAdminPitchOwnerPayout({
      ownerId: parsed.data.ownerId,
      amountEtb: parsed.data.amountEtb ?? null,
      initiatedByUserId: adminCheck.user!.id,
      callbackUrl: `${origin}/api/payouts/chapa/callback`,
    });
    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create admin payout", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
