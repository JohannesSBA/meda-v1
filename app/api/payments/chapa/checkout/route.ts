import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkoutPaymentSchema } from "@/lib/validations/payments";
import { initializeChapaCheckout } from "@/services/payments";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";

export async function POST(request: Request) {
  const rl = await checkRateLimit(`checkout:${getClientId(request)}`, 5, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before initiating another payment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) {
    return session.response!;
  }

  const parsed = await parseJsonBody(checkoutPaymentSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid payment payload");
  }

  const baseUrl = new URL(request.url).origin;
  const callbackUrl =
    process.env.CHAPA_CALLBACK_URL ??
    `${baseUrl}/api/payments/chapa/callback`;
  const returnUrlBase = `${baseUrl}/payments/chapa/status?eventId=${encodeURIComponent(parsed.data.eventId)}`;

  try {
    const result = await initializeChapaCheckout({
      ...parsed.data,
      userId: session.user.id,
      email: session.user.email ?? `user-${session.user.id}@meda.app`,
      firstName: session.user.name?.split(" ").at(0),
      lastName: session.user.name?.split(" ").slice(1).join(" ") || undefined,
      callbackUrl,
      returnUrlBase,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error("Chapa checkout initialization failed", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
