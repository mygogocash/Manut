import { describe, expect, it } from "vitest";
import { resolvePermissions, SYSTEM_ADMIN_ROLE } from "./rbac";
import { ALL_PERMISSION_CODES } from "@nexora/contracts/common/constants/permissions";

describe("resolvePermissions", () => {
  it("expands the System Admin role to every permission code", () => {
    const perms = resolvePermissions([{ name: SYSTEM_ADMIN_ROLE, isSystem: true, permissionCodes: [] }]);
    expect(perms.length).toBe(new Set(ALL_PERMISSION_CODES).size);
    expect(perms).toContain("crm:read");
  });
  it("does NOT treat a custom role named Admin (isSystem=false) as super admin", () => {
    const perms = resolvePermissions([{ name: "Admin", isSystem: false, permissionCodes: ["leave:read"] }]);
    expect(perms).toEqual(["leave:read"]);
  });
  it("unions and de-duplicates codes across roles", () => {
    const perms = resolvePermissions([
      { name: "HR", isSystem: false, permissionCodes: ["leave:read", "leave:approve"] },
      { name: "Manager", isSystem: false, permissionCodes: ["leave:read"] },
    ]);
    expect(perms.sort()).toEqual(["leave:approve", "leave:read"]);
  });
  it("returns an empty set for a user with no roles", () => {
    expect(resolvePermissions([])).toEqual([]);
  });
});
