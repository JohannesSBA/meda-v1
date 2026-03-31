import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getTicketsHubForUser } from "@/services/ticketsHub";

export async function GET() {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  try {
    const hub = await getTicketsHubForUser({
      userId: sessionCheck.user!.id,
      role: sessionCheck.user!.role ?? null,
      email: sessionCheck.user!.email ?? null,
      parentPitchOwnerUserId: sessionCheck.user!.parentPitchOwnerUserId ?? null,
    });

    return NextResponse.json(hub, { status: 200 });
  } catch (error) {
    logger.error("Failed to load tickets hub", error);
    return NextResponse.json({ error: formatUnknownError(error) }, { status: 500 });
  }
}
