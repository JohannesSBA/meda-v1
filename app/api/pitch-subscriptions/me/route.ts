import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getCurrentOwnerSubscription } from "@/services/subscriptions";

export async function GET() {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const subscription = await getCurrentOwnerSubscription(sessionCheck.user!.id);
    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load owner subscription", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}
