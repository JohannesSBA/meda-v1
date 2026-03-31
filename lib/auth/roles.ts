import { prisma } from "@/lib/prisma";

export type AppUserRole =
  | "admin"
  | "pitch_owner"
  | "facilitator"
  | "user";

export const APP_USER_ROLES: readonly AppUserRole[] = [
  "admin",
  "pitch_owner",
  "facilitator",
  "user",
];

export function isAppUserRole(value: unknown): value is AppUserRole {
  return (
    typeof value === "string" &&
    (APP_USER_ROLES as readonly string[]).includes(value)
  );
}

export function normalizeAppUserRole(role: unknown): AppUserRole {
  return isAppUserRole(role) ? role : "user";
}

export type SessionUser = {
  id: string;
  role?: string | null;
  authRole?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  parentPitchOwnerUserId?: string | null;
};

export type NormalizedSessionUser = Omit<SessionUser, "role" | "authRole" | "parentPitchOwnerUserId"> & {
  role: AppUserRole;
  /**
   * Informational only (Neon payload). Authorization must always use `role`.
   */
  authRole: string | null;
  parentPitchOwnerUserId: string | null;
};

export function normalizeSessionUserContract(user: SessionUser): NormalizedSessionUser {
  const authRole =
    typeof user.authRole === "string"
      ? user.authRole
      : typeof user.role === "string"
        ? user.role
        : null;
  const role = normalizeAppUserRole(user.role);

  return {
    ...user,
    role,
    authRole,
    parentPitchOwnerUserId:
      role === "facilitator" && typeof user.parentPitchOwnerUserId === "string"
        ? user.parentPitchOwnerUserId
        : null,
  };
}

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
