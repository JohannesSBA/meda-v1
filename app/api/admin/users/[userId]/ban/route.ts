import { NextResponse } from "next/server";
import { callNeonAdminPost } from "@/lib/auth/neonAdmin";
import { requireAdminUser } from "@/lib/auth/guards";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;
  const { userId } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    banned?: boolean;
    banReason?: string;
    banExpiresIn?: number;
  };
  const banned = Boolean(body.banned);

  const result = banned
    ? await callNeonAdminPost(request, "admin/ban-user", {
        userId,
        banReason: body.banReason || "Violation of community policy",
        banExpiresIn: body.banExpiresIn ?? undefined,
      })
    : await callNeonAdminPost(request, "admin/unban-user", { userId });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({ ok: true, banned });
}
