import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  adminPromoCodeCreateSchema,
} from "@/lib/validations/admin";
import {
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/validations/http";
import { createPromoCode, listPromoCodes } from "@/services/promoCode";

export async function GET() {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  try {
    const promoCodes = await listPromoCodes();
    return NextResponse.json({ promoCodes }, { status: 200 });
  } catch (error) {
    logger.error("Failed to load promo codes", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const parsed = await parseJsonBody(adminPromoCodeCreateSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid promo code");
  }

  try {
    const promoCode = await createPromoCode(parsed.data);
    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create promo code", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
