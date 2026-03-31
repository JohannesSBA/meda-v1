import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { subscriptionMutationSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { startOwnerSubscription } from "@/services/subscriptions";

export async function POST(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(subscriptionMutationSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid subscription payload");
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await startOwnerSubscription({
      ownerId: sessionCheck.user!.id,
      callbackUrl: `${origin}/api/payments/chapa/callback`,
      returnUrlBase: `${origin}/host`,
      ...parsed.data,
    });
    revalidatePath("/host");
    revalidatePath("/create-events");
    return NextResponse.json(
      result,
      { status: result.checkoutUrl ? 201 : 200 },
    );
  } catch (error) {
    logger.error("Failed to start owner subscription", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
