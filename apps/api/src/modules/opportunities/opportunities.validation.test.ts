import { describe, expect, it } from "vitest";

import { createOpportunitySchema } from "@/modules/opportunities/opportunities.validation";

const base = {
  name: "Acme deal",
  accountId: "acct1",
  value: 1000,
};

describe("createOpportunitySchema — businessUnits", () => {
  it("given duplicate codes > dedupes them", () => {
    const out = createOpportunitySchema.parse({
      ...base,
      businessUnits: ["onewave", "aria", "onewave"],
    });

    expect(out.businessUnits).toEqual(["onewave", "aria"]);
  });

  it("given no businessUnits field > leaves it undefined, not []", () => {
    const out = createOpportunitySchema.parse(base);

    expect(out.businessUnits).toBeUndefined();
  });

  it("given 11 copies of one code > dedupes before the max-count check, so it passes", () => {
    // Regression: .max(10) used to run BEFORE the dedupe transform, so 11
    // copies of a single code — which collapse to one unit — were rejected.
    const out = createOpportunitySchema.parse({
      ...base,
      businessUnits: Array(11).fill("onewave"),
    });

    expect(out.businessUnits).toEqual(["onewave"]);
  });

  it("given 11 distinct codes > still rejects, dedupe does not remove the limit", () => {
    const codes = Array.from({ length: 11 }, (_, i) => `bu-${i}`);

    expect(() =>
      createOpportunitySchema.parse({ ...base, businessUnits: codes }),
    ).toThrow();
  });
});
