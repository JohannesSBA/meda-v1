import { NextResponse } from "next/server";
import { callNeonAdminGet } from "@/lib/auth/neonAdmin";
import { requireAdminUser } from "@/lib/auth/guards";
import { parseSearchParams, validationErrorResponse } from "@/lib/validations/http";
import { adminListUsersQuerySchema } from "@/lib/validations/admin";

function normalizeUsersPayload(raw: unknown) {
  const body = (raw ?? null) as
    | {
        users?: unknown[];
        total?: number;
        data?: { users?: unknown[]; total?: number };
      }
    | null;
  const users = body?.users ?? body?.data?.users ?? [];
  const total =
    body?.total ?? body?.data?.total ?? (Array.isArray(users) ? users.length : 0);
  return {
    users: Array.isArray(users) ? users : [],
    total: Number(total) || 0,
  };
}

export async function GET(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const url = new URL(request.url);
  const parsed = parseSearchParams(adminListUsersQuerySchema, url.searchParams);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid user search query");
  }

  const { search, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const result = await callNeonAdminGet(request, "admin/list-users", {
    limit,
    offset,
    searchValue: search || undefined,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 },
    );
  }

  const { users, total } = normalizeUsersPayload(result.data);
  return NextResponse.json({ users, total, page, limit });
}
