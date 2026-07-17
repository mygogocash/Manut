import { describe, expect, it } from "vitest";

import { postLoginPath, sanitizeReturnPath } from "../src/auth/return-path";
import type { AuthSession } from "../src/auth/auth-types";

const EMPLOYEE_SESSION: AuthSession = {
  user: {
    id: "employee-1",
    email: "employee@manut.example",
    name: "Manut Employee",
    avatarUrl: null,
    department: null,
    jobTitle: null,
    entity: null,
    mustChangePassword: false,
  },
  roles: [{ id: "employee-role", name: "Employee", defaultRoute: null }],
  permissions: ["performance:read"],
};

describe("sanitizeReturnPath", () => {
  it("preserves a valid deep-link query string", () => {
    expect(sanitizeReturnPath("/leave?tab=mine&page=2#requests")).toBe(
      "/leave?tab=mine&page=2#requests",
    );
  });

  it("accepts a fully encoded local path", () => {
    expect(sanitizeReturnPath("%2Fperformance%3Fcycle%3Dactive")).toBe(
      "/performance?cycle=active",
    );
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/%2fattacker.example/path",
    "/%252fattacker.example/path",
    "/safe\\attacker",
    "/safe%255cattacker",
    "/safe%0aheader",
    "/../admin",
    "/%252e%252e/admin",
    "/sign-in?returnTo=/dashboard",
  ])("rejects unsafe return path %s", (value) => {
    expect(sanitizeReturnPath(value)).toBeUndefined();
  });

  it("sends employee-only users to their portal by default", () => {
    expect(postLoginPath(EMPLOYEE_SESSION)).toBe("/my-portal");
  });
});
