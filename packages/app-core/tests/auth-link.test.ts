import { describe, expect, it } from "vitest";

import { parseAuthLink } from "../src/auth/auth-link";

describe("parseAuthLink", () => {
  it("reads a sign-in session from a URL fragment", () => {
    expect(
      parseAuthLink(
        "manut-intranet://auth/callback#access_token=access&refresh_token=refresh&type=magiclink",
        "sign-in",
      ),
    ).toEqual({
      ok: true,
      tokens: { accessToken: "access", refreshToken: "refresh" },
    });
  });

  it("reads a recovery session from query parameters", () => {
    expect(
      parseAuthLink(
        "/reset-password?access_token=access&refresh_token=refresh&type=recovery",
        "recovery",
      ),
    ).toMatchObject({ ok: true });
  });

  it("does not accept a recovery link as a sign-in link", () => {
    expect(
      parseAuthLink(
        "/auth/callback#access_token=access&refresh_token=refresh&type=recovery",
        "sign-in",
      ),
    ).toEqual({
      ok: false,
      message: "This sign-in link is invalid or has expired.",
    });
  });

  it("returns a decoded provider error without exposing token parameters", () => {
    expect(
      parseAuthLink(
        "/auth/callback#error_description=Link+expired&access_token=secret",
        "sign-in",
      ),
    ).toEqual({ ok: false, message: "Link expired" });
  });
});
