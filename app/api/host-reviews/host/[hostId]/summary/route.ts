import { NextResponse } from "next/server";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { hostReviewHostParamsSchema } from "@/lib/validations/hostReviews";
import { getHostReviewSummary } from "@/services/hostReviews";

export async function GET(_request: Request, context: { params: Promise<{ hostId: string }> }) {
  const parsedParams = parseParams(hostReviewHostParamsSchema, await context.params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid host id");
  }

  const summary = await getHostReviewSummary(parsedParams.data.hostId);
  return NextResponse.json(summary, { status: 200 });
}
