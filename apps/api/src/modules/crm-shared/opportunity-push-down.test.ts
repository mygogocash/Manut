import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { planDealFieldPushDown } from "@/modules/crm-shared/opportunity-push-down";
import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "@/modules/crm-shared/opportunity-rollup";

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

/**
 * Apply a plan to a set of children, the way the repository will once the
 * per-child updates hit the database. Lets every test assert the real
 * invariant: after push-down, a recompute reproduces what was submitted.
 */
const apply = (
  children: readonly BusinessUnitProgress[],
  plan: ReturnType<typeof planDealFieldPushDown>,
): BusinessUnitProgress[] =>
  children.map((row) => {
    const patch = plan.find((p) => p.businessUnit === row.businessUnit);
    return patch ? { ...row, ...patch.data } : row;
  });

describe("planDealFieldPushDown", () => {
  const twoUnits = [
    unit({
      businessUnit: "onewave",
      stage: "live",
      probability: 100,
      value: new Prisma.Decimal("300000.00"),
      closeDate: new Date("2026-03-01"),
    }),
    unit({
      businessUnit: "onewave-revenue",
      stage: "proposal",
      probability: 40,
      value: new Prisma.Decimal("200000.00"),
      closeDate: new Date("2026-09-01"),
    }),
  ];
  const tagOrder = ["onewave", "onewave-revenue"];

  it("returns an empty plan for a deal with no units", () => {
    // Nothing to push onto, and the roll-up leaves such a deal alone.
    expect(
      planDealFieldPushDown([], STAGE_ORDER, [], { stage: "negotiation" }),
    ).toEqual([]);
  });

  it("returns an empty plan when the patch touches no per-unit field", () => {
    // A rename must not disturb the child rows at all.
    expect(planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {})).toEqual(
      [],
    );
  });

  it("pushes a stage edit onto the least-advanced unit only", () => {
    // The deal's stage IS the least-advanced unit's stage, so that is the
    // row the edit has to land on. The advanced unit must not be dragged
    // backwards — units disagreeing is the whole point of the feature.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      stage: "negotiation",
      probability: 60,
      probabilityCustom: true,
    });

    expect(plan).toEqual([
      {
        businessUnit: "onewave-revenue",
        data: {
          stage: "negotiation",
          probability: 60,
          probabilityCustom: true,
        },
      },
    ]);

    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.stage).toBe("negotiation");
    expect(after?.probability).toBe(60);
    expect(after?.probabilityCustom).toBe(true);
  });

  it("re-splits a value edit proportionally and sums to it exactly", () => {
    // 300k/200k is a split a rep made deliberately. Moving the deal to
    // 600k must scale it (360k/240k), not collapse everything onto the
    // first tag and destroy the second unit's figure.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      value: new Prisma.Decimal("600000.00"),
    });

    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.value.toFixed(2)).toBe("600000.00");

    const byUnit = new Map(plan.map((p) => [p.businessUnit, p.data.value]));
    expect(byUnit.get("onewave")?.toFixed(2)).toBe("360000.00");
    expect(byUnit.get("onewave-revenue")?.toFixed(2)).toBe("240000.00");
  });

  it("absorbs rounding on the last unit so the sum is exact", () => {
    // Three equal units and a value that does not divide by three. Naive
    // per-unit rounding sums to 999.99 or 1000.02; the deal total must be
    // what the rep typed, to the cent.
    const three = [
      unit({ businessUnit: "a", value: new Prisma.Decimal("10.00") }),
      unit({ businessUnit: "b", value: new Prisma.Decimal("10.00") }),
      unit({ businessUnit: "c", value: new Prisma.Decimal("10.00") }),
    ];
    const plan = planDealFieldPushDown(three, STAGE_ORDER, ["a", "b", "c"], {
      value: new Prisma.Decimal("1000.00"),
    });

    const after = computeOpportunityRollup(apply(three, plan), STAGE_ORDER, [
      "a",
      "b",
      "c",
    ]);
    expect(after?.value.toFixed(2)).toBe("1000.00");
  });

  it("puts the whole value on the first tag when the units all sit at zero", () => {
    // There is no ratio to preserve, so proportional scaling is undefined.
    // Falls back to the backfill's rule rather than inventing a split.
    const zeroed = [
      unit({ businessUnit: "onewave" }),
      unit({ businessUnit: "onewave-revenue" }),
    ];
    const plan = planDealFieldPushDown(zeroed, STAGE_ORDER, tagOrder, {
      value: new Prisma.Decimal("500000.00"),
    });

    const byUnit = new Map(plan.map((p) => [p.businessUnit, p.data.value]));
    expect(byUnit.get("onewave")?.toFixed(2)).toBe("500000.00");
    expect(byUnit.get("onewave-revenue")?.toFixed(2)).toBe("0.00");
  });

  it("pushes a close-date edit onto the unit holding the latest date", () => {
    // closeDate rolls up as the MAX, so only the unit currently holding
    // that maximum can change the deal's value.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      closeDate: new Date("2026-12-31"),
    });

    expect(plan).toEqual([
      {
        businessUnit: "onewave-revenue",
        data: { closeDate: new Date("2026-12-31") },
      },
    ]);

    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.closeDate).toEqual(new Date("2026-12-31"));
  });

  it("pulls a close date EARLIER than a sibling onto every unit", () => {
    // Writing 2026-01-01 onto only the max-holder would leave the sibling
    // at 2026-03-01, and MAX would report that instead — the edit would
    // silently not take.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      closeDate: new Date("2026-01-01"),
    });

    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.closeDate).toEqual(new Date("2026-01-01"));
  });

  it("pushes a launch-date edit onto the unit holding the earliest date", () => {
    // launchDate rolls up as the MIN of non-nulls.
    const launched = [
      unit({ businessUnit: "onewave", launchDate: new Date("2026-04-01") }),
      unit({
        businessUnit: "onewave-revenue",
        stage: "proposal",
        launchDate: new Date("2026-08-01"),
      }),
    ];
    const plan = planDealFieldPushDown(launched, STAGE_ORDER, tagOrder, {
      launchDate: new Date("2026-02-01"),
    });

    const after = computeOpportunityRollup(
      apply(launched, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.launchDate).toEqual(new Date("2026-02-01"));
  });

  it("clears a date on every unit when the deal clears it", () => {
    // MIN/MAX ignore nulls, so leaving one unit's date behind would
    // resurrect it as the deal's value.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      closeDate: null,
    });

    expect(plan).toHaveLength(2);
    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.closeDate).toBeNull();
  });

  it("zeroes every unit when the deal value goes to zero", () => {
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      value: new Prisma.Decimal(0),
    });

    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.value.toFixed(2)).toBe("0.00");
  });

  it("writes a lost reason where the roll-up will read it back", () => {
    // lostReason only surfaces when every unit is lost, and then it is the
    // first non-null in tag order.
    const allLost = [
      unit({ businessUnit: "onewave", stage: "closed_lost" }),
      unit({ businessUnit: "onewave-revenue", stage: "closed_lost" }),
    ];
    const plan = planDealFieldPushDown(allLost, STAGE_ORDER, tagOrder, {
      lostReason: "price",
    });

    const after = computeOpportunityRollup(
      apply(allLost, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.lostReason).toBe("price");
  });

  it("leaves an untouched field alone on every unit", () => {
    // A stage-only edit must not rewrite values or dates.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      stage: "negotiation",
    });

    for (const patch of plan) {
      expect(patch.data.value).toBeUndefined();
      expect(patch.data.closeDate).toBeUndefined();
    }
  });
  it("moves EVERY unit when the stage change settles the whole deal", () => {
    // closeLost / reopen are not ordinary edits. With the flag, every unit
    // goes to the new stage and the roll-up reports it.
    const plan = planDealFieldPushDown(
      twoUnits,
      STAGE_ORDER,
      tagOrder,
      { stage: "closed_lost", probability: 0 },
      { stageAppliesToEveryUnit: true },
    );

    expect(plan).toHaveLength(2);
    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.stage).toBe("closed_lost");
    expect(after?.probability).toBe(0);
  });

  it("would silently fail to close a multi-unit deal without that flag", () => {
    // Why the flag exists. closed_lost sorts LAST, so marking only the
    // least-advanced unit lost leaves the sibling at `live` defining the
    // roll-up — the deal reports live and the action appears to do nothing.
    const plan = planDealFieldPushDown(twoUnits, STAGE_ORDER, tagOrder, {
      stage: "closed_lost",
    });

    const after = computeOpportunityRollup(
      apply(twoUnits, plan),
      STAGE_ORDER,
      tagOrder,
    );
    expect(after?.stage).toBe("live");
    expect(after?.stage).not.toBe("closed_lost");
  });
});
