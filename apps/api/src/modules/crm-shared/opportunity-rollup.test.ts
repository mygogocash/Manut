import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "@/modules/crm-shared/opportunity-rollup";

// Mirrors the seeded catalog: qualified → proposal → negotiation →
// closed_won → live, with closed_lost parked at the end.
const STAGE_ORDER = new Map([
  ["qualified", 10],
  ["proposal", 20],
  ["negotiation", 30],
  ["closed_won", 40],
  ["live", 50],
  ["closed_lost", 60],
]);

const unit = (
  over: Partial<BusinessUnitProgress> & { businessUnit: string },
): BusinessUnitProgress => ({
  stage: "qualified",
  probability: 20,
  probabilityCustom: false,
  value: new Prisma.Decimal(0),
  closeDate: null,
  launchDate: null,
  revenueLaunchDate: null,
  lostReason: null,
  sortOrderWithinStage: 0,
  ...over,
});

describe("computeOpportunityRollup", () => {
  it("returns null when the deal has no business units", () => {
    // The caller must then leave the stored values alone. Rolling up to
    // defaults here would silently reset every untagged deal to
    // qualified / 0 on its first write.
    expect(computeOpportunityRollup([], STAGE_ORDER, [])).toBeNull();
  });

  it("takes the stage of the least-advanced unit", () => {
    // The reported case: Onewave is Live, Onewave Revenue is still at
    // Proposal. The deal must not read as Live.
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "onewave", stage: "live", probability: 100 }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          probability: 40,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.stage).toBe("proposal");
    expect(result?.probability).toBe(40);
  });

  it("breaks ties on tag-array order", () => {
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          probability: 45,
        }),
        unit({ businessUnit: "onewave", stage: "proposal", probability: 35 }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.probability).toBe(35);
  });

  it("treats a stage missing from the catalog as least advanced", () => {
    // An admin deleted the stage out from under the row. Claiming
    // progress we cannot verify is worse than surfacing the bad data.
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "onewave", stage: "live" }),
        unit({ businessUnit: "onewave-revenue", stage: "ghost-stage" }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.stage).toBe("ghost-stage");
  });

  it("sums value across units without float drift", () => {
    // `.toFixed(2)` is too weak a check here: native float addition of
    // 0.1 + 0.1 + 0.1 gives 0.30000000000000004, and toFixed(2) rounds
    // that to "0.30" too, so the old two-unit / toFixed(2) version of this
    // test would still pass even if the implementation summed with plain
    // JS numbers instead of Prisma.Decimal. Three units exercises the same
    // classic float bug, and `.equals()` compares the exact decimal value
    // rather than a rounded string, so it actually fails on drift.
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "a", value: new Prisma.Decimal("0.1") }),
        unit({ businessUnit: "b", value: new Prisma.Decimal("0.1") }),
        unit({ businessUnit: "c", value: new Prisma.Decimal("0.1") }),
      ],
      STAGE_ORDER,
      ["a", "b", "c"],
    );

    expect(result?.value.equals(new Prisma.Decimal("0.3"))).toBe(true);
  });

  it("takes the latest close date and the earliest launch dates", () => {
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          closeDate: new Date("2026-01-31"),
          launchDate: new Date("2026-03-01"),
          revenueLaunchDate: new Date("2026-04-01"),
        }),
        unit({
          businessUnit: "onewave-revenue",
          closeDate: new Date("2026-06-30"),
          launchDate: new Date("2026-02-01"),
          revenueLaunchDate: null,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    // Contractually done when the LAST unit closes; "first go-live" for
    // the launch dates, ignoring nulls.
    expect(result?.closeDate).toEqual(new Date("2026-06-30"));
    expect(result?.launchDate).toEqual(new Date("2026-02-01"));
    expect(result?.revenueLaunchDate).toEqual(new Date("2026-04-01"));
  });

  it("only marks the deal lost when every unit is lost", () => {
    const partial = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "closed_lost",
          lostReason: "price",
        }),
        unit({ businessUnit: "onewave-revenue", stage: "negotiation" }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );
    expect(partial?.lostReason).toBeNull();

    const all = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "closed_lost",
          lostReason: "price",
        }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "closed_lost",
          lostReason: "timing",
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );
    // First reason in tag order wins, so the value is stable across runs.
    expect(all?.lostReason).toBe("price");
  });

  it("rolls a single-unit deal up to exactly that unit", () => {
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "negotiation",
          probability: 60,
          value: new Prisma.Decimal("40000.00"),
          closeDate: new Date("2026-05-05"),
        }),
      ],
      STAGE_ORDER,
      ["onewave"],
    );

    expect(result).toEqual({
      stage: "negotiation",
      probability: 60,
      probabilityCustom: false,
      value: new Prisma.Decimal("40000.00"),
      closeDate: new Date("2026-05-05"),
      launchDate: null,
      revenueLaunchDate: null,
      lostReason: null,
      sortOrderWithinStage: 0,
    });
  });
  it("carries probabilityCustom from the same unit as the probability", () => {
    // The flag and the number must describe the same row. Deriving
    // `probability` from the least-advanced unit while leaving a stale
    // `probabilityCustom: true` on the deal is how a recompute ends up
    // claiming a rep typed a number it actually computed.
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "onewave", stage: "live", probability: 100 }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          probability: 55,
          probabilityCustom: true,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.probability).toBe(55);
    expect(result?.probabilityCustom).toBe(true);
  });

  it("clears probabilityCustom when the least-advanced unit is catalog-driven", () => {
    // The reverse direction matters just as much: a manual probability on
    // an ADVANCED unit must not leave the deal flagged custom once a
    // catalog-driven unit becomes the one holding it back.
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "live",
          probability: 90,
          probabilityCustom: true,
        }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          probability: 40,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.probability).toBe(40);
    expect(result?.probabilityCustom).toBe(false);
  });

  it("takes sortOrderWithinStage from the least-advanced unit", () => {
    // The deal row keeps a sortOrderWithinStage because the legacy list
    // ordering still reads it. It tracks the unit whose stage the deal
    // reports, so the deal sorts where that unit's card sits.
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "live",
          sortOrderWithinStage: 7,
        }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          sortOrderWithinStage: 3,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.sortOrderWithinStage).toBe(3);
  });

  it("breaks a full tie on business-unit code, not on argument order", () => {
    // Two units sharing a stage and BOTH missing from the tag array tie
    // on stage and again on tag index. The rows reach this function from
    // an unordered findMany, so resolving the tie by argument order would
    // make the roll-up depend on DB row order and flap between runs.
    const orphanA = unit({
      businessUnit: "aurora",
      stage: "proposal",
      probability: 41,
    });
    const orphanB = unit({
      businessUnit: "borealis",
      stage: "proposal",
      probability: 42,
    });

    const forward = computeOpportunityRollup(
      [orphanA, orphanB],
      STAGE_ORDER,
      [],
    );
    const reversed = computeOpportunityRollup(
      [orphanB, orphanA],
      STAGE_ORDER,
      [],
    );

    expect(forward?.probability).toBe(41);
    expect(reversed?.probability).toBe(41);
  });
});
