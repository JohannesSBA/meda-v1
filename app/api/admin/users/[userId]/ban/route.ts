import { NextResponse } from "next/server";
import { callNeonAdminPost } from "@/lib/auth/neonAdmin";
import { requireAdminUser } from "@/lib/auth/guards";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { adminBanUpdateSchema, adminUserIdParamSchema } from "@/lib/validations/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const paramParse = parseParams(adminUserIdParamSchema, await params);
  if (!paramParse.success) {
    return validationErrorResponse(paramParse.error, "Invalid user id");
  }

  const bodyParse = await parseJsonBody(adminBanUpdateSchema, request);
  if (!bodyParse.success) {
    return validationErrorResponse(bodyParse.error, "Invalid ban payload");
  }

  const result = bodyParse.data.banned
    ? await callNeonAdminPost(request, "admin/ban-user", {
        userId: paramParse.data.userId,
        banReason:
          bodyParse.data.banReason || "Moderation action from admin panel",
        banExpiresIn: bodyParse.data.banExpiresIn,
      })
    : await callNeonAdminPost(request, "admin/unban-user", {
        userId: paramParse.data.userId,
      });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ ok: true, banned: bodyParse.data.banned });
}
