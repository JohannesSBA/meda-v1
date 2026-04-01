import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { createHostReviewSchema } from "@/lib/validations/hostReviews";
import { createReview, HostReviewEligibilityError } from "@/services/hostReviews";

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(createHostReviewSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid review payload");
  }

  try {
    const review = await createReview({
      eventId: parsed.data.eventId,
      reviewerId: sessionCheck.user!.id,
      rating: parsed.data.rating,
      tags: parsed.data.tags,
    });

    revalidatePath("/play");
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/hosts/${review.hostId}`);

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof HostReviewEligibilityError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
