import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { moveBusinessUnitRow } from "@/modules/opportunities/opportunity-business-unit-moves";

const db = vi.hoisted(() => ({
  opportunityBusinessUnit: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  opportunityStageConfig: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

beforeEach(() => {
  vi.clearAllMocks();
  db.opportunityStageConfig.findMany.mockResolvedValue([
    { key: "qualified", sortOrder: 10, probability: 20 },
    { key: "proposal", sortOrder: 20, probability: 40 },
    { key: "live", sortOrder: 50, probability: 100 },
  ]);
  db.opportunityBusinessUnit.findUnique.mockResolvedValue({
    businessUnit: "onewave",
    stage: "qualified",
    probability: 20,
    probabilityCustom: false,
  });
  db.opportunityBusinessUnit.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(db)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("moveBusinessUnitRow", () => {
  it("moves one unit's stage and drops it at the top of the new column", async () => {
    // Matches the deal-level drag behaviour: a card that changes column
    // lands at the top of the destination.
    await moveBusinessUnitRow("opp1", "onewave", { stage: "proposal" });

    expect(db.opportunityBusinessUnit.update).toHaveBeenCalledWith({
      where: {
        opportunityId_businessUnit: {
          opportunityId: "opp1",
          businessUnit: "onewave",
        },
      },
      data: {
        stage: "proposal",
        probability: 40,
        sortOrderWithinStage: 0,
      },
    });
  });

  it("snaps probability to the destination stage's catalog value", async () => {
    // Same precedence as OpportunityService.getStageProbability: the
    // admin-tuned catalog row for the destination, not a code constant.
    await moveBusinessUnitRow("opp1", "onewave", { stage: "live" });

    const data = db.opportunityBusinessUnit.update.mock.calls[0][0].data;
    expect(data.probability).toBe(100);
  });

  it("preserves a rep's manual probability across a stage move", async () => {
    // probabilityCustom means a human typed it. A stage move must not
    // silently overwrite that — the deal-level update has the same rule.
    db.opportunityBusinessUnit.findUnique.mockResolvedValue({
      businessUnit: "onewave",
      stage: "qualified",
      probability: 77,
      probabilityCustom: true,
    });

    await moveBusinessUnitRow("opp1", "onewave", { stage: "proposal" });

    const data = db.opportunityBusinessUnit.update.mock.calls[0][0].data;
    expect(data.probability).toBeUndefined();
  });

  it("does not reset the sort order when the stage is unchanged", async () => {
    // An in-place field edit is not a column move; resetting the order
    // would make a card jump to the top of its own column on any edit.
    await moveBusinessUnitRow("opp1", "onewave", { stage: "qualified" });

    const data = db.opportunityBusinessUnit.update.mock.calls[0][0].data;
    expect(data.sortOrderWithinStage).toBeUndefined();
  });

  it("writes a value edit against the unit, not the deal", async () => {
    await moveBusinessUnitRow("opp1", "onewave", {
      value: new Prisma.Decimal("125000.00"),
    });

    const data = db.opportunityBusinessUnit.update.mock.calls[0][0].data;
    expect(data.value.toFixed(2)).toBe("125000.00");
  });

  it("returns false when the unit has no row on that deal", async () => {
    // The caller decides what to do — a synthesized card has to be seeded
    // before it can be moved, and silently creating a row here would
    // bypass the seed-versus-new-tag rule.
    db.opportunityBusinessUnit.findUnique.mockResolvedValue(null);

    const moved = await moveBusinessUnitRow("opp1", "ghost", {
      stage: "proposal",
    });

    expect(moved).toBe(false);
    expect(db.opportunityBusinessUnit.update).not.toHaveBeenCalled();
  });
});
