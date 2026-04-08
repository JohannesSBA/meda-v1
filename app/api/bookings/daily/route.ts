import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { getAppBaseUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { dailyBookingCreateSchema } from "@/lib/validations/bookingInventory";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { createDailyBooking } from "@/services/bookings";

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parsed = await parseJsonBody(dailyBookingCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid daily booking payload");
  }

  try {
    const publicBaseUrl = getAppBaseUrl();
    const result = await createDailyBooking({
      slotId: parsed.data.slotId,
      quantity: parsed.data.quantity,
      paymentMethod: parsed.data.paymentMethod,
      userId: sessionCheck.user!.id,
      userEmail: sessionCheck.user!.email ?? null,
      userName: sessionCheck.user!.name ?? null,
      callbackUrl:
        process.env.CHAPA_CALLBACK_URL ?? `${publicBaseUrl}/api/payments/chapa/callback`,
      returnUrlBase: `${publicBaseUrl}/tickets`,
    });

    revalidatePath("/tickets");
    revalidatePath("/play");
    revalidatePath("/host");
    return NextResponse.json(result, { status: result.checkoutUrl ? 201 : 200 });
  } catch (error) {
    logger.error("Failed to create daily booking", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
