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

export type NormalizedSessionUser = Omit<
  SessionUser,
  "role" | "authRole" | "parentPitchOwnerUserId"
> & {
  role: AppUserRole;
  /**
   * Informational only (Neon payload). Authorization must always use `role`.
   */
  authRole: string | null;
  parentPitchOwnerUserId: string | null;
};

export function normalizeSessionUserContract(
  user: SessionUser,
): NormalizedSessionUser {
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
