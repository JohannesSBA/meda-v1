import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { cancelOwnerSubscription } from "@/services/subscriptions";

export async function POST() {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const subscription = await cancelOwnerSubscription(sessionCheck.user!.id);
    revalidatePath("/host");
    revalidatePath("/create-events");
    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    logger.error("Failed to cancel owner subscription", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
