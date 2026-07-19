import { describe, expect, it } from "vitest";

import {
  PENDING_COMPATIBILITY_REDIRECTS,
  resolveCompatibilityRedirect,
} from "../src/rbac/compatibility-redirects";

describe("resolveCompatibilityRedirect", () => {
  it("maps /hrms/esop/:employeeId to /hrms/grants/:employeeId", () => {
    const employeeId = "11111111-1111-4111-8111-111111111111";
    expect(resolveCompatibilityRedirect(`/hrms/esop/${employeeId}`)).toBe(
      `/hrms/grants/${employeeId}`,
    );
  });

  it("preserves query and hash on the ESOP → grants redirect", () => {
    const employeeId = "11111111-1111-4111-8111-111111111111";
    expect(
      resolveCompatibilityRedirect(
        `/hrms/esop/${employeeId}?tab=vesting#detail`,
      ),
    ).toBe(`/hrms/grants/${employeeId}?tab=vesting#detail`);
  });

  it("does not redirect the grants target or the HRMS hub", () => {
    expect(
      resolveCompatibilityRedirect(
        "/hrms/grants/11111111-1111-4111-8111-111111111111",
      ),
    ).toBeNull();
    expect(resolveCompatibilityRedirect("/hrms")).toBeNull();
    expect(resolveCompatibilityRedirect("/hrms/esop")).toBeNull();
  });

  it("does not auto-redirect /expenses-v1 until product approval", () => {
    expect(resolveCompatibilityRedirect("/expenses-v1")).toBeNull();
    expect(resolveCompatibilityRedirect("/expenses-v1/reports")).toBeNull();
  });
});

describe("PENDING_COMPATIBILITY_REDIRECTS", () => {
  it("records /expenses-v1 as a pending product decision toward /expenses", () => {
    const expensesV1 = PENDING_COMPATIBILITY_REDIRECTS.find(
      (entry) => entry.fromPrefix === "/expenses-v1",
    );
    expect(expensesV1).toMatchObject({
      proposedToPrefix: "/expenses",
      decision: "pending-product-approval",
    });
  });
});
