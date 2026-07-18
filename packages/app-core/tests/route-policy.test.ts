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
      "leave:hr-settings",
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

  it("blocks employee-only accounts from leave policies admin", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/leave/policies",
        permissions: ["leave:hr-settings"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it("gates expense and cash-advance approval chain admin routes", () => {
    expect(resolveRoutePolicy("/expenses/approval")?.permissions).toEqual([
      "expense:assign-approver",
      "expense:hr-settings",
      "expense:hr-read",
      "expense:approve",
    ]);
    expect(resolveRoutePolicy("/cash-advance/approval")?.permissions).toEqual([
      "cash-advance:approve",
    ]);
    expect(
      evaluateRouteAccess({
        pathname: "/expenses/approval",
        permissions: ["expense:approve"],
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

  it.each([
    "payroll:read",
    "payroll:create",
    "payroll:approve",
    "payroll:hr-admin",
  ])("allows the payroll route with %s", (permission) => {
    expect(
      evaluateRouteAccess({
        pathname: "/payroll",
        permissions: [permission],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies the payroll route when no accepted permission is present", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/payroll",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

  it.each([
    "accounting:read",
    "accounting:create",
    "accounting:approve",
    "accounting:post",
    "accounting:admin",
  ])("allows the accounting route with %s", (permission) => {
    expect(
      evaluateRouteAccess({
        pathname: "/accounting",
        permissions: [permission],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies the accounting route when no accepted permission is present", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/accounting",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

  it("allows the revenue route with revenue:read", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/revenue",
        permissions: ["revenue:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies the revenue route when revenue:read is missing", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/revenue",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

  it.each([
    "crm:read",
    "crm:team-read",
    "crm:create",
    "crm:update",
    "crm:delete",
    "deals:read",
  ])("allows the sales route with %s", (permission) => {
    expect(
      evaluateRouteAccess({
        pathname: "/sales",
        permissions: [permission],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies the sales route for employee-only shells", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/sales",
        permissions: ["crm:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it.each([
    "partners:read",
    "partners:create",
    "partners:update",
    "partners:delete",
  ])("allows the partners route with %s", (permission) => {
    expect(
      evaluateRouteAccess({
        pathname: "/partners",
        permissions: [permission],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies the partners route for employee-only shells", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/partners",
        permissions: ["partners:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it.each(["career:read", "career:create", "career:update", "career:delete"])(
    "allows the careers route with %s",
    (permission) => {
      expect(
        evaluateRouteAccess({
          pathname: "/careers",
          permissions: [permission],
          employeeOnly: true,
        }),
      ).toMatchObject({ allowed: true });
    },
  );

  it("denies the careers route when no accepted permission is present", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/careers",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

  it("blocks employee-only accounts from the applications recruiter inbox", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/applications",
        permissions: ["application:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it("allows applications for non-employee accounts with application:read", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/applications",
        permissions: ["application:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("blocks employee-only accounts from CRM workspace hubs", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/it-crm",
        permissions: ["it-crm:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
    expect(
      evaluateRouteAccess({
        pathname: "/qa-crm",
        permissions: ["qa-crm:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "employee-boundary" });
  });

  it("allows CRM workspace hubs for non-employee accounts with read perms", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/it-crm",
        permissions: ["it-crm:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/product-crm",
        permissions: ["product-crm:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/legal-crm",
        permissions: ["legal-crm:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/accounting-crm",
        permissions: ["accounting-crm:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/qa-crm",
        permissions: ["qa-crm:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/voucher-crm",
        permissions: ["voucher-crm:read"],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("gates Wave 4 files, drive, and messages foundations", () => {
    expect(
      evaluateRouteAccess({
        pathname: "/files",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/drive",
        permissions: ["integrations:use"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/drive",
        permissions: [],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
    expect(
      evaluateRouteAccess({
        pathname: "/messages",
        permissions: ["messages:read"],
        employeeOnly: true,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateRouteAccess({
        pathname: "/messages",
        permissions: [],
        employeeOnly: false,
      }),
    ).toMatchObject({ allowed: false, reason: "missing-permission" });
  });

});
