import { describe, expect, it } from "vitest";

import { isAllowedCorsOrigin, resolveCorsOptions } from "./cors";

describe("resolveCorsOptions", () => {
  it("enables credentialed CORS for allowlisted Expo web origins", () => {
    const options = resolveCorsOptions({
      CORS_ALLOWED_ORIGINS: "http://127.0.0.1:3000,http://127.0.0.1:8081",
      NODE_ENV: "test",
    });

    expect(options.origins).toEqual([
      "http://127.0.0.1:3000",
      "http://127.0.0.1:8081",
    ]);
    expect(options.credentials).toBe(true);
  });

  it("includes local Expo web origins in the non-production fallback list", () => {
    const options = resolveCorsOptions({ NODE_ENV: "development" });

    expect(options.origins).toContain("http://127.0.0.1:8081");
    expect(options.origins).toContain("http://localhost:8081");
    expect(options.credentials).toBe(true);
  });

  it("fails closed with no credentialed origins in production without config", () => {
    const options = resolveCorsOptions({ NODE_ENV: "production" });

    expect(options.origins).toEqual([]);
    expect(options.credentials).toBe(false);
  });

  it("prefers CORS_ALLOWED_ORIGINS over PORTAL_URL", () => {
    const options = resolveCorsOptions({
      CORS_ALLOWED_ORIGINS: "http://127.0.0.1:8081",
      PORTAL_URL: "http://127.0.0.1:3000",
      NODE_ENV: "production",
    });

    expect(options.origins).toEqual(["http://127.0.0.1:8081"]);
    expect(options.credentials).toBe(true);
  });

  it("enables credentials for an explicit production PORTAL_URL allowlist", () => {
    const options = resolveCorsOptions({
      PORTAL_URL: "https://app.manut.xyz",
      NODE_ENV: "production",
    });

    expect(options.origins).toEqual(["https://app.manut.xyz"]);
    expect(options.credentials).toBe(true);
  });

  it("strips trailing slashes so browser Origin headers can match", () => {
    const options = resolveCorsOptions({
      CORS_ALLOWED_ORIGINS: "http://127.0.0.1:8081/,https://app.manut.xyz/",
      NODE_ENV: "production",
    });

    expect(options.origins).toEqual([
      "http://127.0.0.1:8081",
      "https://app.manut.xyz",
    ]);
  });

  it("rejects wildcard origins that would break credentialed CORS", () => {
    const options = resolveCorsOptions({
      CORS_ALLOWED_ORIGINS: "*,http://127.0.0.1:8081",
      NODE_ENV: "production",
    });

    expect(options.origins).toEqual(["http://127.0.0.1:8081"]);
    expect(options.credentials).toBe(true);
  });

  it("fails closed when the allowlist is only wildcards or blanks", () => {
    const options = resolveCorsOptions({
      CORS_ALLOWED_ORIGINS: " * , , ",
      NODE_ENV: "production",
    });

    expect(options.origins).toEqual([]);
    expect(options.credentials).toBe(false);
  });
});

describe("isAllowedCorsOrigin", () => {
  const allowlist = ["http://127.0.0.1:8081", "http://127.0.0.1:3000"];

  it("allows exact allowlisted origins only", () => {
    expect(isAllowedCorsOrigin("http://127.0.0.1:8081", allowlist)).toBe(true);
    expect(isAllowedCorsOrigin("http://127.0.0.1:3000", allowlist)).toBe(true);
  });

  it("rejects missing, foreign, and localhost/production lookalikes", () => {
    expect(isAllowedCorsOrigin(undefined, allowlist)).toBe(false);
    expect(isAllowedCorsOrigin("", allowlist)).toBe(false);
    expect(isAllowedCorsOrigin("https://evil.example", allowlist)).toBe(false);
    expect(isAllowedCorsOrigin("http://localhost:8081", allowlist)).toBe(false);
    expect(isAllowedCorsOrigin("http://127.0.0.1:8081.evil.example", allowlist)).toBe(
      false,
    );
  });

  it("never allows when the allowlist is empty (production fail-closed)", () => {
    expect(isAllowedCorsOrigin("http://127.0.0.1:8081", [])).toBe(false);
  });
});
