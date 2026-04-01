import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_TRANSITION_POLICY_NOTE,
  isAllowedAdminRoleTransition,
} from "@/lib/auth/adminRoleTransitions";

describe("admin role transitions", () => {
  it("documents auth-role-only admin mutation policy", () => {
    expect(ADMIN_ROLE_TRANSITION_POLICY_NOTE).toMatch(/base auth role/i);
    expect(ADMIN_ROLE_TRANSITION_POLICY_NOTE).toMatch(/pitch_owner/i);
  });

  it("allows user <-> admin transitions only", () => {
    expect(isAllowedAdminRoleTransition("user", "admin")).toBe(true);
    expect(isAllowedAdminRoleTransition("admin", "user")).toBe(true);
    expect(isAllowedAdminRoleTransition("user", "user")).toBe(false);
    expect(isAllowedAdminRoleTransition("admin", "admin")).toBe(false);
  });
});
