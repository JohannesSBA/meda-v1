import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkoutPaymentSchema } from "@/lib/validations/payments";
import { initializeChapaCheckout } from "@/services/payments";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown checkout error";
  }
}

export async function POST(request: Request) {
  const rl = checkRateLimit(`checkout:${getClientId(request)}`, 5, 60_000);
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

  const body = await request.json().catch(() => null);
  const parsed = checkoutPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payment payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    new URL(request.url).origin;
  const callbackUrl =
    process.env.CHAPA_CALLBACK_URL ??
    `${baseUrl}/api/payments/chapa/confirm`;
  const returnUrlBase = `${baseUrl}/events/${parsed.data.eventId}?payment=chapa`;

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
    const message = formatUnknownError(error);
    console.error("Chapa checkout initialization failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
