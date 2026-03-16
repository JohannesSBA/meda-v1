import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  adminPromoCodeIdParamSchema,
  adminPromoCodePatchSchema,
} from "@/lib/validations/admin";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { updatePromoCode } from "@/services/promoCode";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const parsedParams = parseParams(adminPromoCodeIdParamSchema, await params);
  if (!parsedParams.success) {
    return validationErrorResponse(parsedParams.error, "Invalid promo code id");
  }

  const parsedBody = await parseJsonBody(adminPromoCodePatchSchema, request);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error, "Invalid promo code update");
  }

  try {
    const promoCode = await updatePromoCode({
      id: parsedParams.data.id,
      ...parsedBody.data,
    });
    return NextResponse.json({ promoCode }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update promo code", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
