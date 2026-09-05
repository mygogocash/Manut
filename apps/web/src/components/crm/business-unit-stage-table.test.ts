import { describe, expect, it } from "vitest";

import { rollUpStage } from "@/components/crm/business-unit-stage-table";

// Canonical catalog order — qualified is least advanced, closed_lost last.
const ORDER: Record<string, number> = {
  qualified: 10,
  proposal: 20,
  negotiation: 30,
  closed_won: 40,
  live: 45,
  closed_lost: 50,
};
const sortOrder = (s: string) => ORDER[s] ?? Number.MAX_SAFE_INTEGER;

describe("rollUpStage", () => {
  it("returns null with no units, so the deal keeps its own stage", () => {
    // An untagged deal must not have its stage derived from nothing — that is
    // what keeps the plain Stage field working for deals with no units.
    expect(rollUpStage([], sortOrder)).toBeNull();
  });

  it("picks the LEAST advanced unit", () => {
    // The reported case: Onewave Qualified, ARIA Live. The deal must not read
    // as Live while a unit is still at Qualified.
    expect(
      rollUpStage(
        [
          { businessUnit: "aria", stage: "live" },
          { businessUnit: "onewave", stage: "qualified" },
        ],
        sortOrder,
      ),
    ).toBe("qualified");
  });

  it("is order-independent", () => {
    const rows = [
      { businessUnit: "a", stage: "closed_won" },
      { businessUnit: "b", stage: "proposal" },
      { businessUnit: "c", stage: "live" },
    ];
    expect(rollUpStage(rows, sortOrder)).toBe("proposal");
    expect(rollUpStage([...rows].reverse(), sortOrder)).toBe("proposal");
  });

  it("treats an unknown stage as most advanced, not least", () => {
    // The server ranks an unknown stage LEAST advanced deliberately; here the
    // catalog always covers the canonical stages, so an unrecognised value is
    // a stale form value and must not hijack the roll-up away from a real one.
    expect(
      rollUpStage(
        [
          { businessUnit: "a", stage: "retired_stage" },
          { businessUnit: "b", stage: "proposal" },
        ],
        sortOrder,
      ),
    ).toBe("proposal");
  });

  it("rolls a single unit up to exactly that unit", () => {
    expect(
      rollUpStage(
        [{ businessUnit: "onewave", stage: "negotiation" }],
        sortOrder,
      ),
    ).toBe("negotiation");
  });
});
