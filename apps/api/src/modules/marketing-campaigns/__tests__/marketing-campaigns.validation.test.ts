import { describe, expect, it } from "vitest";

import {
  createCreativeSchema,
  createPredictionSchema,
} from "@/modules/marketing-campaigns/marketing-campaigns.validation";

// Guards the fix for the stored-XSS vector: a creative/prediction `url` that
// is a non-http(s) scheme (`javascript:` / `data:` / `vbscript:`) must be
// rejected on write so it can never become an executable href in the client.
describe("marketing-campaigns url scheme validation", () => {
  it("accepts http(s) URLs", () => {
    expect(
      createCreativeSchema.safeParse({
        kind: "link",
        source: "drive",
        name: "Q3 launch deck",
        url: "https://drive.google.com/file/d/abc/view",
      }).success,
    ).toBe(true);
    expect(
      createPredictionSchema.safeParse({
        format: "csv",
        name: "forecast",
        url: "http://example.com/forecast.csv",
      }).success,
    ).toBe(true);
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ])("rejects the dangerous scheme %s", (url) => {
    expect(
      createCreativeSchema.safeParse({
        kind: "link",
        source: "other",
        name: "x",
        url,
      }).success,
    ).toBe(false);
    expect(
      createPredictionSchema.safeParse({ format: "csv", name: "x", url })
        .success,
    ).toBe(false);
  });
});
