export const ADMIN_MUTABLE_AUTH_ROLES = ["admin", "user"] as const;

export type AdminMutableAuthRole = (typeof ADMIN_MUTABLE_AUTH_ROLES)[number];

const ALLOWED_ADMIN_ROLE_TRANSITIONS: Readonly<Record<AdminMutableAuthRole, readonly AdminMutableAuthRole[]>> = {
  admin: ["user"],
  user: ["admin"],
};

export function isAllowedAdminRoleTransition(
  from: AdminMutableAuthRole,
  to: AdminMutableAuthRole,
) {
  return ALLOWED_ADMIN_ROLE_TRANSITIONS[from].includes(to);
}

export const ADMIN_ROLE_TRANSITION_POLICY_NOTE =
  "Admin role API controls only base auth role (admin/user). Marketplace roles like pitch_owner/facilitator come from domain relationships.";
