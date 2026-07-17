import { describe, expect, it } from "vitest";

import {
  authEmailSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "../src/auth/auth-schemas";

describe("auth input schemas", () => {
  it("normalizes a valid email request", () => {
    expect(
      authEmailSchema.safeParse({ email: "  person@example.invalid  " }),
    ).toEqual({ success: true, data: { email: "person@example.invalid" } });
  });

  it("rejects malformed email input", () => {
    expect(authEmailSchema.safeParse({ email: "not-an-email" })).toMatchObject({
      success: false,
      issues: [{ path: "email" }],
    });
  });

  it("requires matching reset passwords of at least eight characters", () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: "short",
        confirmPassword: "different",
      }),
    ).toMatchObject({ success: false });
    expect(
      resetPasswordSchema.safeParse({
        newPassword: "long-enough",
        confirmPassword: "long-enough",
      }),
    ).toMatchObject({ success: true });
  });

  it("requires the current password for an authenticated password change", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "long-enough",
        confirmPassword: "long-enough",
      }),
    ).toMatchObject({
      success: false,
      issues: [{ path: "currentPassword" }],
    });
  });
});
