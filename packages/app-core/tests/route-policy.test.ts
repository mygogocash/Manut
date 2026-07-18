import { describe, expect, it } from "vitest";

import {
  evaluateRouteAccess,
  resolveRoutePolicy,
} from "../src/rbac/route-policy";

describe("route policy resolution", () => {
  it("uses the explicit leaf override before a prefix", () => {
    expect(resolveRoutePolicy("/leave")?.permissions).toEqual([
      "leave:read",
      "leave:hr-read",
    ]);
    expect(resolveRoutePolicy("/leave/holidays")?.permissions).toEqual([
      "leave:read",
      "leave:hr-read",
      "leave:hr-settings",
    ]);
    expect(resolveRoutePolicy("/leave/approval")?.permissions).toEqual([
      "leave:assign-approver",
      "leave:hr-settings",
    ]);
    expect(resolveRoutePolicy("/leave/policies")?.permissions).toEqual([
      "leave:read",
    ]);
  });

  it("blocks employee-only accounts from leave approval chain admin", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/leave/approval",
        permissions: ["leave:hr-settings"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it("does not admit an approver-only account to the balance-led Leave page", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/leave",
        permissions: ["leave:approve"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

  it("matches only on a segment boundary", () => {
    expect(resolveRoutePolicy("/performance-review")).toBeUndefined();
    expect(resolveRoutePolicy("/performance/cycle/1")?.path).toBe(
      "/performance",
    );
  });

  it("uses the longest matching segment prefix", () => {
    expect(resolveRoutePolicy("/expenses-v1/reports")?.path).toBe(
      "/expenses-v1",
    );
  });

  it("allows an employee with performance permission", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/performance",
        permissions: ["performance:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true, policy: { employeeAllowed: true } });
  });

  it.each([
    "performance:read",
    "performance:self-review",
    "performance:manager-review",
    "performance:hr-manage",
    "performance:goals",
  ])("allows the performance route with %s", (permission) => {
    expect(
      evaluateRouteAccess({
        pathname: "/performance",
        permissions: [permission],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies the performance route when no accepted permission is present", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/performance",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

  it("keeps employee-only accounts away from the dashboard", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/dashboard",
        permissions: ["home:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it("keeps employee-only accounts away from admin employees and roles", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/employees",
        permissions: ["user:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
    expect(
      evaluateRouteAccess({
        pathname: "/roles",
        permissions: ["role:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it("allows non-employee admins with user:read and role:read", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/employees",
        permissions: ["user:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/roles",
        permissions: ["role:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
  });
});
