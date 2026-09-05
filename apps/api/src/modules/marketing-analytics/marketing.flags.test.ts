import { afterEach, describe, expect, it } from "vitest";

import { isMarketingAnalyticsEnabled } from "@/modules/marketing-analytics/marketing.flags";

const original = process.env.MARKETING_ANALYTICS_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.MARKETING_ANALYTICS_ENABLED;
  else process.env.MARKETING_ANALYTICS_ENABLED = original;
});

describe("isMarketingAnalyticsEnabled", () => {
  it("is OFF when the var is unset", () => {
    // The case that matters most: a release reaching production without the
    // variable configured must keep the family dark, not expose it.
    delete process.env.MARKETING_ANALYTICS_ENABLED;
    expect(isMarketingAnalyticsEnabled()).toBe(false);
  });

  it('is ON only for the exact string "true"', () => {
    process.env.MARKETING_ANALYTICS_ENABLED = "true";
    expect(isMarketingAnalyticsEnabled()).toBe(true);
  });

  it.each(["1", "TRUE", "True", "yes", "on", "", " true"])(
    "fail-closes on the truthy-looking value %o",
    (value) => {
      // A mistyped value is the realistic mistake, and every one of these is
      // truthy in JS. `=== "true"` is what makes them all hide the module
      // instead of a plain `Boolean(...)` exposing it.
      process.env.MARKETING_ANALYTICS_ENABLED = value;
      expect(isMarketingAnalyticsEnabled()).toBe(false);
    },
  );
});
