import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  bookingIdParamSchema,
} from "@/lib/validations/bookingInventory";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { createBookingPoolShareLink } from "@/services/bookingTicketSharing";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown booking share-link error";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const parsed = parseParams(bookingIdParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid booking id");
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const result = await createBookingPoolShareLink({
      bookingId: parsed.data.id,
      ownerUserId: session.user.id,
      baseUrl,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
