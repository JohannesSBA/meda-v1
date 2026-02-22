import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { checkoutPaymentSchema } from "@/lib/validations/payments";
import { initializeChapaCheckout } from "@/services/payments";

export async function POST(request: Request) {
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

  const origin = new URL(request.url).origin;
  const callbackUrl = process.env.CHAPA_CALLBACK_URL ?? `${origin}/api/payments/chapa/confirm`;
  const returnUrlBase = `${origin}/events/${parsed.data.eventId}?payment=chapa`;
  if (!session.user.email) {
    return NextResponse.json(
      { error: "Your account must have an email address to make payments" },
      { status: 400 }
    );
  }

  try {
    const result = await initializeChapaCheckout({
      ...parsed.data,
      userId: session.user.id,
      email: session.user.email,
      firstName: session.user.name?.split(" ").at(0),
      lastName: session.user.name?.split(" ").slice(1).join(" ") || undefined,
      callbackUrl,
      returnUrlBase,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not initialize payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
