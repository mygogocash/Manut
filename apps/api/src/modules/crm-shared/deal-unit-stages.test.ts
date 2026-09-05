import { describe, expect, it } from "vitest";

import { dealUnitStages } from "@/modules/crm-shared/deal-unit-stages";

/**
 * Chip stages on the one-card-per-partner board.
 *
 * The cases that matter are the three seeding states, because all three are
 * present in live data simultaneously and a reader must not be able to tell
 * them apart.
 */

describe("dealUnitStages", () => {
  it("takes each unit's own stage when the deal is seeded", () => {
    expect(
      dealUnitStages(
        ["onewave", "aria"],
        [
          { businessUnit: "onewave", stage: "live" },
          { businessUnit: "aria", stage: "qualified" },
        ],
        "qualified",
      ),
    ).toEqual([
      { businessUnit: "onewave", stage: "live" },
      { businessUnit: "aria", stage: "qualified" },
    ]);
  });

  it("falls back to the deal's stage for an unseeded deal", () => {
    // What seeding would write anyway, so the chip does not change the
    // instant somebody opens the deal and the lazy seed fires.
    expect(dealUnitStages(["onewave", "aria"], [], "negotiation")).toEqual([
      { businessUnit: "onewave", stage: "negotiation" },
      { businessUnit: "aria", stage: "negotiation" },
    ]);
  });

  it("resolves per unit, not per deal, when partially seeded", () => {
    // `businessUnitService.delete` strips one unit's rows across every deal,
    // so a mix is normal. Gating the fallback on "this deal has no rows at
    // all" is the bug that dropped un-seeded units off the old board.
    expect(
      dealUnitStages(
        ["onewave", "aria"],
        [{ businessUnit: "onewave", stage: "live" }],
        "qualified",
      ),
    ).toEqual([
      { businessUnit: "onewave", stage: "live" },
      { businessUnit: "aria", stage: "qualified" },
    ]);
  });

  it("ignores a progress row for a unit the deal no longer carries", () => {
    // The tag list decides which units a deal HAS. A leftover row must not
    // resurrect a chip for a unit somebody untagged.
    expect(
      dealUnitStages(
        ["onewave"],
        [
          { businessUnit: "onewave", stage: "live" },
          { businessUnit: "aria", stage: "closed_won" },
        ],
        "live",
      ),
    ).toEqual([{ businessUnit: "onewave", stage: "live" }]);
  });

  it("preserves tag order, which is the roll-up's tie-break order", () => {
    const out = dealUnitStages(
      ["onewave-revenue", "aria", "onewave"],
      [],
      "live",
    );
    expect(out.map((u) => u.businessUnit)).toEqual([
      "onewave-revenue",
      "aria",
      "onewave",
    ]);
  });

  it("returns no chips for an untagged deal", () => {
    // The caller renders a plain "Unassigned" chip. There is no unit whose
    // stage could differ from the column, so a stage suffix would be noise.
    expect(dealUnitStages([], [], "live")).toEqual([]);
  });

  it("de-duplicates a repeated code", () => {
    // `businessUnits` is a plain text[] with no unique constraint.
    expect(
      dealUnitStages(
        ["onewave", "onewave"],
        [{ businessUnit: "onewave", stage: "live" }],
        "qualified",
      ),
    ).toEqual([{ businessUnit: "onewave", stage: "live" }]);
  });
});
