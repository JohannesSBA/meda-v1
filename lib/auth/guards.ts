import { NextResponse } from "next/server";
import { auth } from "./server";

type SessionUser = {
  id: string;
  role?: string | null;
  email?: string | null;
  name?: string | null;
};

export async function requireSessionUser() {
  const { data } = await auth.getSession();
  const user = (data?.user ?? null) as SessionUser | null;
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    };
  }
  return { user, response: null as NextResponse | null };
}

export async function requireAdminUser() {
  const sessionCheck = await requireSessionUser();
  if (!sessionCheck.user) return sessionCheck;
  if (sessionCheck.user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return sessionCheck;
}
