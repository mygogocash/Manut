import { describe, expect, it } from "vitest";

import {
  oauthCallbackSchema,
  oauthStartSchema,
} from "@/modules/integrations/integrations.validation";

describe("oauthStartSchema", () => {
  it("given empty query > parses with redirect undefined", () => {
    const out = oauthStartSchema.parse({});
    expect(out.redirect).toBeUndefined();
  });

  it("given absolute URL redirect > keeps it", () => {
    const out = oauthStartSchema.parse({ redirect: "https://example.com/x" });
    expect(out.redirect).toBe("https://example.com/x");
  });

  it("given relative path redirect > keeps it", () => {
    const out = oauthStartSchema.parse({ redirect: "/settings?tab=int" });
    expect(out.redirect).toBe("/settings?tab=int");
  });

  it("given non-string redirect > throws", () => {
    expect(() => oauthStartSchema.parse({ redirect: 123 })).toThrow();
  });
});

describe("oauthCallbackSchema", () => {
  it("given code + state > parses", () => {
    const out = oauthCallbackSchema.parse({ code: "C", state: "S" });
    expect(out).toEqual({ code: "C", state: "S" });
  });

  it("given code + state + error > parses with error", () => {
    const out = oauthCallbackSchema.parse({
      code: "",
      state: "S",
      error: "access_denied",
    });
    expect(out.error).toBe("access_denied");
  });

  it("given missing state > throws", () => {
    expect(() => oauthCallbackSchema.parse({ code: "C" })).toThrow();
  });
});
