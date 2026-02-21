import { NextResponse } from "next/server";
import { callNeonAdminGet } from "@/lib/auth/neonAdmin";
import { requireAdminUser } from "@/lib/auth/guards";

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
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const result = await callNeonAdminGet(request, "admin/list-users", {
    limit,
    offset,
    searchValue: search || undefined,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 }
    );
  }

  const { users, total } = normalizeUsersPayload(result.data);
  return NextResponse.json({ users, total, page, limit });
}
