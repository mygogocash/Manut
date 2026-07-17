import { describe, expect, it } from "vitest";

import { resolveRoutePermissionPolicy } from "@/lib/route-permissions";

describe("resolveRoutePermissionPolicy", () => {
  it("uses an explicit override before the exact registry entry", () => {
    expect(resolveRoutePermissionPolicy("/leave")?.permissions).toContain(
      "leave:approve",
    );
  });

  it("uses an exact leaf before a broader prefix", () => {
    expect(
      resolveRoutePermissionPolicy("/leave/policies")?.permissions,
    ).toEqual(["leave:hr-settings", "leave:bulk-import"]);
  });

  it("uses the longest matching segment-boundary prefix", () => {
    expect(
      resolveRoutePermissionPolicy("/legal/announcements/announcement-1")
        ?.permissions,
    ).toEqual(["legal:announcement-read"]);
    expect(
      resolveRoutePermissionPolicy("/legal/shared/document-1")?.permissions,
    ).toEqual(["legal:view-shared"]);
  });

  it("does not treat a partial segment as a prefix match", () => {
    expect(resolveRoutePermissionPolicy("/performance-review")).toBeUndefined();
    expect(resolveRoutePermissionPolicy("/performance/cycle/1")?.path).toBe(
      "/performance",
    );
  });

  it("uses the shared project-detail override for team CRM users", () => {
    expect(
      resolveRoutePermissionPolicy("/projects/project-1")?.permissions,
    ).toContain("it-crm:read");
    expect(resolveRoutePermissionPolicy("/projects/dashboard")?.path).toBe(
      "/projects/dashboard",
    );
  });

  it("allows employee navigation to Performance with its read permission", () => {
    const policy = resolveRoutePermissionPolicy("/performance");

    expect(policy?.employeeAllowed).toBe(true);
    expect(policy?.permissions).toContain("performance:read");
  });
});
