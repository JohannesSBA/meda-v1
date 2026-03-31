import { prisma } from "@/lib/prisma";
import {
  normalizeSessionUserContract,
  type AppUserRole,
  type SessionUser,
} from "@/lib/auth/session-contract";

export * from "@/lib/auth/session-contract";

export async function enrichSessionUser<T extends SessionUser | null>(user: T) {
  if (!user?.id) {
    return user;
  }

  const authRole =
    typeof user.authRole === "string"
      ? user.authRole
      : typeof user.role === "string"
        ? user.role
        : null;
  if (authRole === "admin") {
    return normalizeSessionUserContract({
      ...user,
      role: "admin" as AppUserRole,
      authRole,
      parentPitchOwnerUserId: null,
    });
  }

  const [pitchOwnerProfile, facilitator] = await Promise.all([
    prisma.pitchOwnerProfile.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    }),
    prisma.facilitator.findUnique({
      where: { facilitatorUserId: user.id },
      select: { pitchOwnerUserId: true, isActive: true },
    }),
  ]);

  const role: AppUserRole = pitchOwnerProfile
    ? "pitch_owner"
    : facilitator?.isActive
      ? "facilitator"
      : "user";

  return normalizeSessionUserContract({
    ...user,
    role,
    authRole,
    parentPitchOwnerUserId:
      role === "facilitator" ? facilitator?.pitchOwnerUserId ?? null : null,
  });
}

export function canCreateEvent(user: Pick<SessionUser, "role"> | null | undefined) {
  return user?.role === "admin" || user?.role === "pitch_owner";
}

export function canManageEvent(
  user: Pick<SessionUser, "id" | "role"> | null | undefined,
  eventOwnerUserId: string,
) {
  return user?.role === "admin" || (user?.role === "pitch_owner" && user.id === eventOwnerUserId);
}

export function canScanEvent(
  user:
    | {
        id?: string | null;
        role?: string | null;
        parentPitchOwnerUserId?: string | null;
      }
    | null
    | undefined,
  eventOwnerUserId: string,
) {
  return (
    user?.role === "admin" ||
    user?.id === eventOwnerUserId ||
    (user?.role === "facilitator" &&
      user.parentPitchOwnerUserId === eventOwnerUserId)
  );
}
