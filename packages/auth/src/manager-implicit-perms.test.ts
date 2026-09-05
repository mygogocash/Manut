import { describe, expect, it } from "vitest";
import { applyManagerImplicitPerms, MANAGER_IMPLICIT_PERMS } from "./manager-implicit-perms";

describe("applyManagerImplicitPerms", () => {
  it("adds the manager perms when the user has direct reports", () => {
    const perms = new Set<string>(["leave:read", "leave:request"]);
    applyManagerImplicitPerms(perms, true);
    for (const code of MANAGER_IMPLICIT_PERMS) {
      expect(perms.has(code)).toBe(true);
    }
    expect(perms.has("leave:read")).toBe(true);
    expect(perms.has("leave:request")).toBe(true);
  });

  it("is a no-op when the user has no direct reports", () => {
    const perms = new Set<string>(["leave:read"]);
    applyManagerImplicitPerms(perms, false);
    for (const code of MANAGER_IMPLICIT_PERMS) {
      expect(perms.has(code)).toBe(false);
    }
    expect(perms.has("leave:read")).toBe(true);
  });

  it("does not duplicate perms the user already has", () => {
    const perms = new Set<string>(["leave:approve"]);
    applyManagerImplicitPerms(perms, true);
    const approveCount = Array.from(perms).filter((p) => p === "leave:approve").length;
    expect(approveCount).toBe(1);
  });
});
