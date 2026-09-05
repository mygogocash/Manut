import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureBusinessUnitRows,
  pushDealFieldsToBusinessUnits,
  recomputeOpportunityRollup,
  seedBusinessUnitRowsFromDeal,
  syncBusinessUnitRows,
} from "@/modules/opportunities/opportunity-business-units.repository";

// The adapter is the only place the derived deal fields are written, so
// assert the exact `data` shape reaching prisma.opportunity.update.
const db = vi.hoisted(() => ({
  opportunity: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  opportunityBusinessUnit: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
  opportunityStageConfig: { findMany: vi.fn() },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

beforeEach(() => {
  vi.clearAllMocks();
  db.opportunityStageConfig.findMany.mockResolvedValue([
    { key: "qualified", sortOrder: 10, probability: 20 },
    { key: "proposal", sortOrder: 20, probability: 40 },
    { key: "live", sortOrder: 50, probability: 100 },
  ]);
  db.opportunityBusinessUnit.findMany.mockResolvedValue([]);
  db.opportunity.findMany.mockResolvedValue([]);
  db.opportunityBusinessUnit.createMany.mockResolvedValue({ count: 0 });
});

describe("recomputeOpportunityRollup", () => {
  it("writes the least-advanced unit's stage onto the deal", async () => {
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: ["onewave", "onewave-revenue"],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      {
        businessUnit: "onewave",
        stage: "live",
        probability: 100,
        probabilityCustom: false,
        value: new Prisma.Decimal("30000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 0,
      },
      {
        businessUnit: "onewave-revenue",
        stage: "proposal",
        probability: 40,
        probabilityCustom: false,
        value: new Prisma.Decimal("10000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 0,
      },
    ]);

    await recomputeOpportunityRollup("opp1");

    const data = db.opportunity.update.mock.calls[0][0].data;
    expect(data.stage).toBe("proposal");
    expect(data.probability).toBe(40);
    expect(data.value.toFixed(2)).toBe("40000.00");
  });

  it("carries probabilityCustom and sortOrderWithinStage off the least-advanced unit", async () => {
    // Both columns exist on the child row and are copied down when a
    // deal is seeded, but nothing read them back up before PR2. Left
    // out of the roll-up payload they are `undefined`, and Prisma skips
    // undefined keys — so the deal would keep a stale
    // `probabilityCustom: true` next to a probability the roll-up
    // computed, and claim a rep typed it.
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: ["onewave", "onewave-revenue"],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      {
        businessUnit: "onewave",
        stage: "live",
        probability: 100,
        probabilityCustom: true,
        value: new Prisma.Decimal("30000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 9,
      },
      {
        businessUnit: "onewave-revenue",
        stage: "proposal",
        probability: 55,
        probabilityCustom: true,
        value: new Prisma.Decimal("10000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 4,
      },
    ]);

    await recomputeOpportunityRollup("opp1");

    const data = db.opportunity.update.mock.calls[0][0].data;
    expect(data.probability).toBe(55);
    expect(data.probabilityCustom).toBe(true);
    expect(data.sortOrderWithinStage).toBe(4);
  });

  it("falls back to the code stage order when the catalog table is empty", async () => {
    // Staging deploys with `db:push`, which creates opportunity_stage_config
    // but never runs the migration INSERT that fills it. Ranking every
    // stage as unknown would make the roll-up pick by tag order alone.
    db.opportunityStageConfig.findMany.mockResolvedValue([]);
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp3",
      businessUnits: ["onewave", "onewave-revenue"],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      {
        businessUnit: "onewave",
        stage: "live",
        probability: 100,
        probabilityCustom: false,
        value: new Prisma.Decimal(0),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 0,
      },
      {
        businessUnit: "onewave-revenue",
        stage: "qualified",
        probability: 20,
        probabilityCustom: false,
        value: new Prisma.Decimal(0),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 0,
      },
    ]);

    await recomputeOpportunityRollup("opp3");

    expect(db.opportunity.update.mock.calls[0][0].data.stage).toBe("qualified");
  });

  it("leaves an untagged deal's stored values alone", async () => {
    // The silent-corruption path: without this guard every deal with no
    // business units resets to qualified / 0 on its first write.
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp2",
      businessUnits: [],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([]);

    await recomputeOpportunityRollup("opp2");

    expect(db.opportunity.update).not.toHaveBeenCalled();
  });
});

describe("syncBusinessUnitRows", () => {
  it("creates a newly tagged unit at the first stage with value 0", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave", "onewave-revenue"]);

    expect(db.opportunityBusinessUnit.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            opportunityId: "opp1",
            businessUnit: "onewave-revenue",
            stage: "qualified",
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it("uses the catalog's admin-tuned probability, not the code default", async () => {
    // opportunities.service.ts `getStageProbability` reads
    // `opportunity_stage_config.probability` first and only falls back to
    // STAGE_PROBABILITY_DEFAULTS when a row is missing — "so admins can
    // tune the snap value without a code change." A newly tagged business
    // unit must land at the same probability a stage move would use.
    db.opportunityStageConfig.findMany.mockResolvedValue([
      { key: "qualified", sortOrder: 10, probability: 25 },
      { key: "proposal", sortOrder: 20, probability: 40 },
      { key: "live", sortOrder: 50, probability: 100 },
    ]);
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave", "onewave-revenue"]);

    expect(db.opportunityBusinessUnit.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            opportunityId: "opp1",
            businessUnit: "onewave-revenue",
            stage: "qualified",
            probability: 25,
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it("falls back to the code default probability when the catalog table is empty", async () => {
    db.opportunityStageConfig.findMany.mockResolvedValue([]);
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave", "onewave-revenue"]);

    expect(db.opportunityBusinessUnit.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            opportunityId: "opp1",
            businessUnit: "onewave-revenue",
            stage: "qualified",
            probability: 20,
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it("given a partially populated catalog, a stage absent from it still resolves via the code constant and a newly tagged unit lands on the true first stage", async () => {
    // Regression for the "gate the fallback on an empty table" bug: staging
    // starts with an empty catalog (db:push never runs the migration
    // INSERT), so a single admin save on ANY one stage flips the table from
    // 0 rows to 1 — a naive "rows.length === 0 ? constants : catalog-only"
    // implementation would then drop every OTHER stage from the map
    // entirely, making a currently-untagged "qualified" (absent from this
    // 1-row catalog) rank as unknown instead of sortOrder 10, and would
    // wrongly hand a newly tagged unit the catalog's only stage. Only
    // `closed_lost` is admin-overridden here; every other stage — including
    // the true first stage, `qualified` — must still resolve from
    // CODE_STAGE_SORT_ORDER / STAGE_PROBABILITY_DEFAULTS.
    db.opportunityStageConfig.findMany.mockResolvedValue([
      { key: "closed_lost", sortOrder: 15, probability: 5 },
    ]);
    db.opportunityBusinessUnit.findMany.mockResolvedValue([]);

    await syncBusinessUnitRows("opp1", ["onewave"]);

    expect(db.opportunityBusinessUnit.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            opportunityId: "opp1",
            businessUnit: "onewave",
            stage: "qualified",
            probability: 20,
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it("deletes the row for an untagged unit", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
      { businessUnit: "onewave-revenue" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave"]);

    expect(db.opportunityBusinessUnit.deleteMany).toHaveBeenCalledWith({
      where: {
        opportunityId: "opp1",
        businessUnit: { in: ["onewave-revenue"] },
      },
    });
  });

  it("does nothing when the tags already match", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave"]);

    expect(db.opportunityBusinessUnit.createMany).not.toHaveBeenCalled();
    expect(db.opportunityBusinessUnit.deleteMany).not.toHaveBeenCalled();
  });
});

describe("seedBusinessUnitRowsFromDeal", () => {
  it("reproduces the deal exactly: whole value on the first tag, rest copied", async () => {
    // The rule the backfill implements, extracted so a write path can use
    // it on ONE deal. Reproduction, not a reset: the roll-up sum has to
    // come back to the deal's own value or a pipeline total moves.
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: ["onewave", "onewave-revenue"],
      stage: "negotiation",
      probability: 60,
      probabilityCustom: true,
      value: new Prisma.Decimal("500000.00"),
      closeDate: new Date("2026-06-30"),
      launchDate: null,
      revenueLaunchDate: null,
      lostReason: null,
      sortOrderWithinStage: 3,
    });

    await seedBusinessUnitRowsFromDeal("opp1");

    const rows = db.opportunityBusinessUnit.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      businessUnit: "onewave",
      stage: "negotiation",
      probability: 60,
      probabilityCustom: true,
      closeDate: new Date("2026-06-30"),
      sortOrderWithinStage: 3,
    });
    expect(rows[0].value.toFixed(2)).toBe("500000.00");
    expect(rows[1].businessUnit).toBe("onewave-revenue");
    expect(rows[1].value.toFixed(2)).toBe("0.00");
    expect(rows[1].stage).toBe("negotiation");

    // The invariant the retired backfill used to guard, carried here now
    // that seeding is per deal: the unit values must SUM back to the deal's
    // own value, so no pipeline total moves the moment a deal is seeded.
    const summed = rows.reduce(
      (acc: Prisma.Decimal, row: { value: Prisma.Decimal }) =>
        acc.add(row.value),
      new Prisma.Decimal(0),
    );
    expect(summed.toFixed(2)).toBe("500000.00");
  });

  it("writes nothing for an untagged deal", async () => {
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: [],
      stage: "qualified",
      probability: 20,
      probabilityCustom: false,
      value: new Prisma.Decimal(0),
      closeDate: null,
      launchDate: null,
      revenueLaunchDate: null,
      lostReason: null,
      sortOrderWithinStage: 0,
    });

    await seedBusinessUnitRowsFromDeal("opp1");

    expect(db.opportunityBusinessUnit.createMany).not.toHaveBeenCalled();
  });

  it("dedupes a duplicated tag before splitting the value", async () => {
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: ["onewave", "onewave"],
      stage: "proposal",
      probability: 40,
      probabilityCustom: false,
      value: new Prisma.Decimal("100.00"),
      closeDate: null,
      launchDate: null,
      revenueLaunchDate: null,
      lostReason: null,
      sortOrderWithinStage: 0,
    });

    await seedBusinessUnitRowsFromDeal("opp1");

    const rows = db.opportunityBusinessUnit.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].value.toFixed(2)).toBe("100.00");
  });
});

describe("ensureBusinessUnitRows", () => {
  const deal = (over = {}) => ({
    id: "opp1",
    businessUnits: ["onewave"],
    stage: "negotiation",
    probability: 60,
    probabilityCustom: false,
    value: new Prisma.Decimal("500000.00"),
    closeDate: new Date("2026-06-30"),
    launchDate: null,
    revenueLaunchDate: null,
    lostReason: null,
    sortOrderWithinStage: 0,
    ...over,
  });

  it("seeds FROM the deal when a tagged deal has no child rows yet", async () => {
    // THE regression. A deal created at negotiation for 500000 must not
    // come back qualified / 0: with no child rows there is nothing to
    // preserve, so the first set reproduces the deal. Treating these tags
    // as "newly added" is what corrupted data and got the wiring reverted.
    db.opportunityBusinessUnit.findMany.mockResolvedValue([]);
    db.opportunity.findUnique.mockResolvedValue(deal());

    const result = await ensureBusinessUnitRows("opp1", ["onewave"]);

    expect(result.mode).toBe("seeded");
    const rows = db.opportunityBusinessUnit.createMany.mock.calls[0][0].data;
    expect(rows[0].stage).toBe("negotiation");
    expect(rows[0].value.toFixed(2)).toBe("500000.00");
  });

  it("starts a genuinely new tag at the first stage with value 0", async () => {
    // The deal already carries units, so this tag has not done the work
    // its siblings have. Seeding it from the deal would claim otherwise
    // and hide it from the roll-up.
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    const result = await ensureBusinessUnitRows("opp1", [
      "onewave",
      "onewave-revenue",
    ]);

    expect(result.mode).toBe("synced");
    expect(result.added).toEqual(["onewave-revenue"]);
    const rows = db.opportunityBusinessUnit.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      businessUnit: "onewave-revenue",
      stage: "qualified",
    });
    expect(rows[0].value.toFixed(2)).toBe("0.00");
    // The deal is never read in this branch — nothing to copy from it.
    expect(db.opportunity.findUnique).not.toHaveBeenCalled();
  });

  it("deletes the row for an untagged unit", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
      { businessUnit: "onewave-revenue" },
    ]);

    const result = await ensureBusinessUnitRows("opp1", ["onewave"]);

    expect(result.removed).toEqual(["onewave-revenue"]);
    expect(db.opportunityBusinessUnit.deleteMany).toHaveBeenCalledWith({
      where: {
        opportunityId: "opp1",
        businessUnit: { in: ["onewave-revenue"] },
      },
    });
  });

  it("does not seed an untagged deal", async () => {
    // Zero child rows AND zero tags is not the seed case — it is a deal
    // that has no units at all, and it must keep its stored values.
    db.opportunityBusinessUnit.findMany.mockResolvedValue([]);

    const result = await ensureBusinessUnitRows("opp1", []);

    expect(result.mode).toBe("synced");
    expect(db.opportunityBusinessUnit.createMany).not.toHaveBeenCalled();
    expect(db.opportunity.findUnique).not.toHaveBeenCalled();
  });

  it("is a no-op when the tags already match the rows", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    const result = await ensureBusinessUnitRows("opp1", ["onewave"]);

    expect(result).toEqual({ mode: "synced", added: [], removed: [] });
    expect(db.opportunityBusinessUnit.createMany).not.toHaveBeenCalled();
    expect(db.opportunityBusinessUnit.deleteMany).not.toHaveBeenCalled();
  });
});

describe("pushDealFieldsToBusinessUnits", () => {
  it("writes a deal stage edit onto the least-advanced unit only", async () => {
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: ["onewave", "onewave-revenue"],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      {
        businessUnit: "onewave",
        stage: "live",
        probability: 100,
        probabilityCustom: false,
        value: new Prisma.Decimal("300000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 0,
      },
      {
        businessUnit: "onewave-revenue",
        stage: "proposal",
        probability: 40,
        probabilityCustom: false,
        value: new Prisma.Decimal("200000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 0,
      },
    ]);

    await pushDealFieldsToBusinessUnits("opp1", { stage: "negotiation" });

    expect(db.opportunityBusinessUnit.update).toHaveBeenCalledTimes(1);
    expect(db.opportunityBusinessUnit.update).toHaveBeenCalledWith({
      where: {
        opportunityId_businessUnit: {
          opportunityId: "opp1",
          businessUnit: "onewave-revenue",
        },
      },
      data: { stage: "negotiation" },
    });
  });

  it("writes nothing when the deal has no child rows", async () => {
    // An untagged deal keeps its stored values; there is nowhere to push.
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: [],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([]);

    await pushDealFieldsToBusinessUnits("opp1", { stage: "negotiation" });

    expect(db.opportunityBusinessUnit.update).not.toHaveBeenCalled();
  });
});
