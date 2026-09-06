import { afterEach, describe, expect, it } from "vitest";

import {
  isLocalDevAuthAllowed,
  isLocalDevToken,
  issueLocalDevSession,
  isSupabaseNotConfiguredError,
  refreshLocalDevSession,
  verifyLocalDevAccessToken,
} from "@/modules/auth/local-dev-auth";

describe("local-dev-auth", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSecret = process.env.DEV_AUTH_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevSecret === undefined) delete process.env.DEV_AUTH_SECRET;
    else process.env.DEV_AUTH_SECRET = prevSecret;
    delete process.env.K_SERVICE;
    delete process.env.VERCEL;
  });

  it("issues a verifiable access token in development", () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_AUTH_SECRET = "test-secret";
    const session = issueLocalDevSession("user-1");
    expect(isLocalDevToken(session.accessToken)).toBe(true);
    expect(isLocalDevToken(session.refreshToken)).toBe(true);
    expect(verifyLocalDevAccessToken(session.accessToken)).toBe("user-1");
  });

  it("refreshes from a refresh token and rejects access tokens", () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_AUTH_SECRET = "test-secret";
    const session = issueLocalDevSession("user-2");
    expect(refreshLocalDevSession(session.accessToken)).toBeNull();
    const next = refreshLocalDevSession(session.refreshToken);
    expect(next?.accessToken).toBeTruthy();
    expect(verifyLocalDevAccessToken(next!.accessToken)).toBe("user-2");
  });

  it("rejects tokens when local-dev auth is disabled", () => {
    process.env.NODE_ENV = "production";
    const session = issueLocalDevSession("user-3");
    expect(isLocalDevAuthAllowed()).toBe(false);
    expect(verifyLocalDevAccessToken(session.accessToken)).toBeNull();
  });

  it("detects the Supabase-not-configured proxy error", () => {
    expect(
      isSupabaseNotConfiguredError(new Error("Supabase is not configured")),
    ).toBe(true);
    expect(isSupabaseNotConfiguredError(new Error("other"))).toBe(false);
  });
});
