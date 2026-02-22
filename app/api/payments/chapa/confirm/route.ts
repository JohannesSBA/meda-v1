import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { confirmPaymentSchema } from "@/lib/validations/payments";
import { confirmChapaPayment } from "@/services/payments";

function parseTxRefFromUrl(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("tx_ref") || url.searchParams.get("trx_ref") || "";
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (!session.user || session.response) {
    return session.response!;
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payment confirmation payload" },
      { status: 400 }
    );
  }

  try {
    const result = await confirmChapaPayment({
      txRef: parsed.data.txRef,
      userId: session.user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (!session.user || session.response) {
    return session.response!;
  }

  const txRef = parseTxRefFromUrl(request);
  const parsed = confirmPaymentSchema.safeParse({ txRef });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing tx_ref query parameter" }, { status: 400 });
  }

  try {
    const result = await confirmChapaPayment({
      txRef: parsed.data.txRef,
      userId: session.user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
