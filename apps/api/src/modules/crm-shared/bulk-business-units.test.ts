import { describe, expect, it } from "vitest";

import {
  countUnitRowsLostByReplace,
  nextBusinessUnits,
} from "@/modules/crm-shared/bulk-business-units";

describe("nextBusinessUnits", () => {
  describe("add", () => {
    it("tags an untagged record — the Unassigned-view case", () => {
      expect(nextBusinessUnits([], ["onewave"], "add")).toEqual(["onewave"]);
    });

    it("appends without disturbing existing order", () => {
      expect(
        nextBusinessUnits(["aria", "onewave"], ["onewave-revenue"], "add"),
      ).toEqual(["aria", "onewave", "onewave-revenue"]);
    });

    it("never removes a tag the record already carries", () => {
      // The whole point of `add`: a mis-aimed bulk apply cannot strip units,
      // and on an opportunity cannot delete a per-unit row with it.
      const next = nextBusinessUnits(["aria", "onewave"], ["aria"], "add");
      expect(next).toBeNull();
    });

    it("returns null when every requested code is already present", () => {
      expect(nextBusinessUnits(["onewave"], ["onewave"], "add")).toBeNull();
    });

    it("de-duplicates a repeated request", () => {
      expect(
        nextBusinessUnits([], ["onewave", "onewave", "aria"], "add"),
      ).toEqual(["onewave", "aria"]);
    });
  });

  describe("replace", () => {
    it("makes the requested set the whole set", () => {
      expect(
        nextBusinessUnits(["aria", "onewave"], ["onewave-revenue"], "replace"),
      ).toEqual(["onewave-revenue"]);
    });

    it("can clear every tag", () => {
      expect(nextBusinessUnits(["onewave"], [], "replace")).toEqual([]);
    });

    it("returns null when the set is unchanged, even if reordered", () => {
      // Reordering alone is not worth a write — on an opportunity a write
      // means a per-unit reconcile plus a roll-up recompute.
      expect(
        nextBusinessUnits(["aria", "onewave"], ["onewave", "aria"], "replace"),
      ).toBeNull();
    });

    it("returns null for an already-empty record cleared again", () => {
      expect(nextBusinessUnits([], [], "replace")).toBeNull();
    });
  });

  it("does not mutate its input", () => {
    const current = ["onewave"];
    nextBusinessUnits(current, ["aria"], "add");
    expect(current).toEqual(["onewave"]);
  });
});

describe("countUnitRowsLostByReplace", () => {
  it("counts the per-unit rows a replace would delete", () => {
    const lost = countUnitRowsLostByReplace(
      [
        { units: ["onewave", "onewave-revenue"] }, // loses onewave-revenue
        { units: ["aria"] }, // loses aria
        { units: ["onewave"] }, // loses nothing
      ],
      ["onewave"],
    );
    expect(lost).toBe(2);
  });

  it("is zero when the replace is a superset of every deal's units", () => {
    expect(
      countUnitRowsLostByReplace(
        [{ units: ["onewave"] }, { units: ["aria"] }],
        ["onewave", "aria", "onewave-revenue"],
      ),
    ).toBe(0);
  });

  it("counts every row when replacing with nothing", () => {
    expect(
      countUnitRowsLostByReplace(
        [{ units: ["onewave", "aria"] }, { units: ["onewave-revenue"] }],
        [],
      ),
    ).toBe(3);
  });

  it("is zero for deals that have no per-unit rows yet", () => {
    // An untagged deal has no child rows, so a replace destroys no history —
    // this is the Unassigned-view case and must not scare the user with a
    // non-zero count.
    expect(countUnitRowsLostByReplace([{ units: [] }], ["onewave"])).toBe(0);
  });
});
