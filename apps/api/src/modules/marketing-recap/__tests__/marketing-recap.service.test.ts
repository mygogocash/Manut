import { describe, expect, it } from "vitest";

import {
  normalizeNotes,
  normalizeTargets,
  RECAP_NOTES_KEY_PREFIX,
} from "@/modules/marketing-recap/marketing-recap.service";
import { recapDateSchema } from "@/modules/marketing-recap/marketing-recap.validation";

describe("recap targets", () => {
  it("keeps well-formed rows and drops the rest", () => {
    expect(
      normalizeTargets([
        { partnerId: "p1", targetDau: 360000, addressableMau: 10800000 },
        { partnerId: "", targetDau: 1 },
        { targetDau: 5 },
        "nope",
      ]),
    ).toEqual([
      {
        partnerId: "p1",
        targetDau: 360000,
        addressableMau: 10800000,
        excluded: false,
      },
    ]);
  });

  it("treats a missing or non-numeric figure as unset, not zero", () => {
    // Zero is a real target; blank is "nobody has said". Rendering a blank as
    // 0 would report every telco as 0% of target.
    const [t] = normalizeTargets([
      { partnerId: "p1", targetDau: "360000", addressableMau: null },
    ]);
    expect(t?.targetDau).toBeNull();
    expect(t?.addressableMau).toBeNull();
  });

  it("carries the excluded flag", () => {
    expect(normalizeTargets([{ partnerId: "gopay", excluded: true }])).toEqual([
      { partnerId: "gopay", targetDau: null, addressableMau: null, excluded: true },
    ]);
  });

  it("returns nothing for a non-array row", () => {
    expect(normalizeTargets(null)).toEqual([]);
    expect(normalizeTargets({ partnerId: "p1" })).toEqual([]);
  });
});

describe("recap notes", () => {
  it("keeps non-blank bullets only", () => {
    expect(
      normalizeNotes({ yesterday: ["held on track", "", "  ", 7], today: ["RYZE"] }),
    ).toEqual({ yesterday: ["held on track"], today: ["RYZE"] });
  });

  it("defaults both lists when the row is absent or malformed", () => {
    expect(normalizeNotes(null)).toEqual({ yesterday: [], today: [] });
    expect(normalizeNotes(["a"])).toEqual({ yesterday: [], today: [] });
  });
});

describe("recap date guard", () => {
  it("accepts a calendar day", () => {
    expect(recapDateSchema.safeParse("2026-08-13").success).toBe(true);
  });

  // The date is concatenated into a SystemSetting primary key.
  it("rejects anything that could address another module's row", () => {
    for (const bad of ["2026-8-3", "../payslip.company", "2026-08-13x", ""]) {
      expect(recapDateSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("composes a key inside the VarChar(100) column", () => {
    expect((RECAP_NOTES_KEY_PREFIX + "2026-08-13").length).toBeLessThan(100);
  });
});
