import { NextResponse } from "next/server";
import { callNeonAdminPost } from "@/lib/auth/neonAdmin";
import { requireAdminUser } from "@/lib/auth/guards";
import {
  parseJsonBody,
  parseParams,
  validationErrorResponse,
} from "@/lib/validations/http";
import { adminRoleUpdateSchema, adminUserIdParamSchema } from "@/lib/validations/admin";

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

  const bodyParse = await parseJsonBody(adminRoleUpdateSchema, request);
  if (!bodyParse.success) {
    return validationErrorResponse(bodyParse.error, "Invalid role payload");
  }

  const result = await callNeonAdminPost(request, "admin/set-role", {
    userId: paramParse.data.userId,
    role: bodyParse.data.role,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ ok: true, role: bodyParse.data.role });
}
