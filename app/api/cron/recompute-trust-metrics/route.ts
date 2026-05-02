import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeHostTrustMetrics } from "@/services/trustScore";
import { logger } from "@/lib/logger";

/**
 * Cron: recompute HostTrustMetrics for all pitch owners whose metrics
 * may have gone stale (check-ins, cancellations, new payments since last update).
 *
 * Recommended schedule: once daily (e.g. "0 3 * * *").
 * Protected by the shared CRON_SECRET bearer token.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.pitchOwnerProfile.findMany({
    select: { userId: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      await computeHostTrustMetrics(profile.userId);
      succeeded++;
    } catch (err) {
      failed++;
      logger.error(`Failed to recompute trust metrics for ${profile.userId}`, err);
    }
  }

  return NextResponse.json({ ok: true, succeeded, failed }, { status: 200 });
}
