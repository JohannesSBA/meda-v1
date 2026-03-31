import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { monthlyBookingCreateSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { createMonthlyBooking } from "@/services/bookings";

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(monthlyBookingCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid monthly booking payload");
  }

  try {
    const booking = await createMonthlyBooking({
      slotId: parsed.data.slotId,
      partyId: parsed.data.partyId,
      partyName: parsed.data.partyName,
      memberEmails: parsed.data.memberEmails,
      userId: sessionCheck.user!.id,
      userEmail: sessionCheck.user!.email ?? null,
    });

    revalidatePath("/tickets");
    revalidatePath("/play");
    revalidatePath("/host");
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create monthly booking", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
