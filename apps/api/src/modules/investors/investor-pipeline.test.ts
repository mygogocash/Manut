import { describe, expect, it } from "vitest";

import {
  investorStatusLabel,
  normalizeInvestorStatus,
} from "./investor-pipeline";

describe("investor-pipeline", () => {
  it("maps legacy statuses to pipeline slugs", () => {
    expect(normalizeInvestorStatus("prospect")).toBe("lead");
    expect(normalizeInvestorStatus("active")).toBe("relationship_management");
  });

  it("maps free-text spreadsheet labels", () => {
    expect(
      normalizeInvestorStatus("Discovery Call/ OnGoing Communication"),
    ).toBe("discovery_call");
    expect(normalizeInvestorStatus("Verbal Commitment")).toBe(
      "verbal_commitment",
    );
    expect(normalizeInvestorStatus("Funds Cleared")).toBe("funds_cleared");
  });

  it("labels pipeline slugs", () => {
    expect(investorStatusLabel("dd")).toBe("DD");
    expect(investorStatusLabel("lead")).toBe("Lead");
  });
});
