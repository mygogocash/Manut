import { describe, expect, it } from "vitest";

import { resolveCorsOptions } from "./cors";

describe("resolveCorsOptions", () => {
  it("enables credentialed CORS for allowlisted Expo web origins", () => {
    const options = resolveCorsOptions({
      CORS_ALLOWED_ORIGINS:
        "http://127.0.0.1:3000,http://127.0.0.1:8081",
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
});
