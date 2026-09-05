import { describe, expect, it } from "vitest";

import { HELPDESK_SLA, slaTargetFor } from "@/modules/helpdesk/helpdesk.sla";

describe("helpdesk SLA policy", () => {
  it("returns the exact tier for a known priority", () => {
    expect(slaTargetFor("urgent")).toEqual(HELPDESK_SLA.urgent);
    expect(slaTargetFor("low")).toEqual(HELPDESK_SLA.low);
  });

  it("falls back to the medium tier for an unknown priority", () => {
    expect(slaTargetFor("p0")).toEqual(HELPDESK_SLA.medium);
    expect(slaTargetFor("")).toEqual(HELPDESK_SLA.medium);
  });

  it("orders tiers so higher priority never has a slacker target", () => {
    // Monotonic: urgent ≤ high ≤ medium ≤ low for both clocks. A regression
    // here (e.g. urgent given a longer window than high) would silently
    // invert the attainment story.
    const tiers = [
      HELPDESK_SLA.urgent,
      HELPDESK_SLA.high,
      HELPDESK_SLA.medium,
      HELPDESK_SLA.low,
    ];
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].response).toBeGreaterThanOrEqual(tiers[i - 1].response);
      expect(tiers[i].resolution).toBeGreaterThanOrEqual(
        tiers[i - 1].resolution,
      );
    }
  });
});
