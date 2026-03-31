import { NextResponse } from "next/server";
import { expirePendingBookings } from "@/services/bookings";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expirePendingBookings();
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
