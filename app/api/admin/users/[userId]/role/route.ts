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

  const body = (await request.json().catch(() => ({}))) as { role?: string };
  const role = body.role === "admin" ? "admin" : "user";

  const result = await callNeonAdminPost(request, "admin/set-role", {
    userId,
    role,
  });
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({ ok: true, role });
}
