import { NextResponse } from "next/server";
import { requirePitchOwnerUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { ownerDashboardQuerySchema } from "@/lib/validations/bookingInventory";
import { parseSearchParams, validationErrorResponse } from "@/lib/validations/http";
import { exportOwnerDashboardCsv } from "@/services/ownerAnalytics";

export async function GET(request: Request) {
  const sessionCheck = await requirePitchOwnerUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = parseSearchParams(
    ownerDashboardQuerySchema,
    new URL(request.url).searchParams,
  );
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid export query");
  }

  try {
    const csv = await exportOwnerDashboardCsv({
      ownerId: sessionCheck.user!.id,
      type: "payments",
      pitchId: parsed.data.pitchId,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="owner-payments.csv"',
      },
    });
  } catch (error) {
    logger.error("Failed to export owner payments", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
