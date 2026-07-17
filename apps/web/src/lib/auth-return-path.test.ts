import { describe, expect, it } from "vitest";

import {
  browserReturnPath,
  postLoginPath,
  sanitizeReturnPath,
  signInPath,
} from "@/lib/auth-return-path";

describe("sanitizeReturnPath", () => {
  it("preserves a valid deep-link query string and hash", () => {
    expect(sanitizeReturnPath("/leave?tab=mine&page=2#request-4")).toBe(
      "/leave?tab=mine&page=2#request-4",
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
    "/safe\\attacker",
    "/../admin",
    "/sign-in?returnTo=/dashboard",
    "%252F%252Fattacker.example",
  ])("rejects unsafe return path %s", (value) => {
    expect(sanitizeReturnPath(value)).toBeUndefined();
  });
});

describe("postLoginPath", () => {
  const admin = {
    mustChangePassword: false,
    roles: [{ name: "Admin" }],
  };

  it("gives password change precedence over a valid return path", () => {
    expect(
      postLoginPath({ ...admin, mustChangePassword: true }, "/leave?tab=mine"),
    ).toBe("/change-password");
  });

  it("uses a validated return path before role defaults", () => {
    expect(postLoginPath(admin, "/leave?tab=mine")).toBe("/leave?tab=mine");
  });

  it("falls back to employee portal, then dashboard", () => {
    expect(
      postLoginPath({
        mustChangePassword: false,
        roles: [{ name: "Employee" }],
      }),
    ).toBe("/my-portal");
    expect(postLoginPath(admin)).toBe("/dashboard");
  });
});

describe("sign-in deep links", () => {
  it("captures the browser query and encodes it as one returnTo value", () => {
    const current = browserReturnPath({
      pathname: "/expenses",
      search: "?status=pending&page=2",
      hash: "#report",
    });

    expect(signInPath(current)).toBe(
      "/sign-in?returnTo=%2Fexpenses%3Fstatus%3Dpending%26page%3D2%23report",
    );
  });
});
