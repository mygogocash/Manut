import { describe, expect, it } from "vitest";

import { normalizeApiBaseUrl } from "../src/api/api-base-url";

describe("normalizeApiBaseUrl > hosted /api contract", () => {
  it("defaults hosted web to same-origin /api when unset", () => {
    expect(normalizeApiBaseUrl(undefined, "web")).toBe("/api");
    expect(normalizeApiBaseUrl("   ", "web")).toBe("/api");
  });

  it("requires an absolute API base for native when unset", () => {
    expect(() => normalizeApiBaseUrl(undefined, "native")).toThrow(
      /EXPO_PUBLIC_API_URL.*native/iu,
    );
  });

  it("keeps relative same-origin /api for web", () => {
    expect(normalizeApiBaseUrl("/api", "web")).toBe("/api");
    expect(normalizeApiBaseUrl("/api/", "web")).toBe("/api");
  });

  it("rejects non-/api relative bases", () => {
    expect(() => normalizeApiBaseUrl("/", "web")).toThrow(/\/api/u);
    expect(() => normalizeApiBaseUrl("/v1", "web")).toThrow(/\/api/u);
  });

  it("appends /api to absolute Worker origins that omit the path", () => {
    expect(normalizeApiBaseUrl("https://app.manut.xyz", "web")).toBe(
      "https://app.manut.xyz/api",
    );
    expect(
      normalizeApiBaseUrl(
        "https://manut-preview.bettergogocash.workers.dev/",
        "native",
      ),
    ).toBe("https://manut-preview.bettergogocash.workers.dev/api");
  });

  it("preserves an absolute base that already ends with /api", () => {
    expect(normalizeApiBaseUrl("https://app.manut.xyz/api", "native")).toBe(
      "https://app.manut.xyz/api",
    );
    expect(normalizeApiBaseUrl("http://127.0.0.1:3001/api/", "web")).toBe(
      "http://127.0.0.1:3001/api",
    );
  });

  it("rejects native non-HTTPS origins outside loopback", () => {
    expect(() =>
      normalizeApiBaseUrl("http://api.example.invalid/api", "native"),
    ).toThrow(/HTTPS/u);
  });

  it("allows native http loopback for local focused tests", () => {
    expect(normalizeApiBaseUrl("http://localhost:3001", "native")).toBe(
      "http://localhost:3001/api",
    );
  });
});
