import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "./api-client";
import { getAppUrl } from "./env";

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefixes the Express /api base", () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", "http://localhost:3001");
    expect(apiUrl("/leave/requests")).toBe("http://localhost:3001/api/leave/requests");
    expect(apiUrl("auth/me")).toBe("http://localhost:3001/api/auth/me");
  });
});

describe("getAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not treat the Expo web origin as the API", () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", "");
    vi.stubGlobal("location", { origin: "http://localhost:8081" });
    expect(getAppUrl()).toBe("http://localhost:3001");
  });

  it("uses EXPO_PUBLIC_APP_URL when set", () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", "http://localhost:8787");
    expect(getAppUrl()).toBe("http://localhost:8787");
  });
});
