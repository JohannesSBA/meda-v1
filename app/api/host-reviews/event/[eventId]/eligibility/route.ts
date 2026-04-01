import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { hostReviewEligibilityParamsSchema } from "@/lib/validations/hostReviews";
import { getEventReviewStateForUser } from "@/services/hostReviews";

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsedParams = parseParams(hostReviewEligibilityParamsSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid event id");
  }

  const state = await getEventReviewStateForUser({
    eventId: parsedParams.data.eventId,
    reviewerId: sessionCheck.user!.id,
  });

  return NextResponse.json(state, { status: 200 });
}
