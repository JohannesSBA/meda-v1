/**
 * Auth guards -- requireAuth and requireAdmin helpers for API routes.
 */

import { NextResponse } from "next/server";
import { auth } from "./server";
import {
  canCreateEvent,
  normalizeAppUserRole,
  type SessionUser,
} from "./roles";

export async function requireSessionUser() {
  const { data } = await auth.getSession();
  const rawUser = (data?.user ?? null) as SessionUser | null;
  const user = rawUser
    ? {
        ...rawUser,
        role: normalizeAppUserRole(rawUser.role),
      }
    : null;
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

export async function requirePitchOwnerUser() {
  const sessionCheck = await requireSessionUser();
  if (!sessionCheck.user) return sessionCheck;
  if (sessionCheck.user.role !== "pitch_owner") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return sessionCheck;
}

export async function requireFacilitatorUser() {
  const sessionCheck = await requireSessionUser();
  if (!sessionCheck.user) return sessionCheck;
  if (sessionCheck.user.role !== "facilitator") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return sessionCheck;
}

export async function requireAdminOrPitchOwnerUser() {
  const sessionCheck = await requireSessionUser();
  if (!sessionCheck.user) return sessionCheck;
  if (!canCreateEvent(sessionCheck.user)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return sessionCheck;
}
