import { beforeEach, describe, expect, it, vi } from "vitest";

import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";

/**
 * Manual card order on the one-card-per-partner board.
 *
 * Ordering moved from the child row back onto the deal when the board
 * collapsed to one card per partner. These are the same three guarantees the
 * per-unit writer carried, re-pinned at the deal grain — plus the one the
 * per-unit version never needed, because a (deal x unit) pair could not
 * repeat within a column and a bare deal id can.
 */

const db = vi.hoisted(() => ({
  opportunity: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

// `vi.mock` is hoisted above the import above it, so the singleton the
// repository module creates on load already holds the mock.
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(db)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("reorderWithinStage", () => {
  it("numbers the supplied order 0..N on the deals", async () => {
    db.opportunity.findMany.mockResolvedValue([
      { id: "opp1", stage: "proposal" },
      { id: "opp2", stage: "proposal" },
    ]);

    await opportunityRepository.reorderWithinStage("proposal", [
      "opp2",
      "opp1",
    ]);

    // Index follows the SUBMITTED order, not the order rows came back in —
    // findMany is unordered, so reading the index off `rows` would scramble
    // the drag.
    expect(
      db.opportunity.update.mock.calls.map((c) => [
        c[0].where.id,
        c[0].data.sortOrderWithinStage,
      ]),
    ).toEqual([
      ["opp2", 0],
      ["opp1", 1],
    ]);
  });

  it("rejects a deal that is not in the target column", async () => {
    // A stale board could otherwise renumber a deal somebody else has since
    // dragged elsewhere, silently moving it back.
    db.opportunity.findMany.mockResolvedValue([
      { id: "opp1", stage: "proposal" },
      { id: "opp2", stage: "live" },
    ]);

    await expect(
      opportunityRepository.reorderWithinStage("proposal", ["opp1", "opp2"]),
    ).rejects.toThrow(/not in stage/i);
    expect(db.opportunity.update).not.toHaveBeenCalled();
  });

  it("rejects an id that does not exist", async () => {
    db.opportunity.findMany.mockResolvedValue([
      { id: "opp1", stage: "proposal" },
    ]);

    await expect(
      opportunityRepository.reorderWithinStage("proposal", ["opp1", "ghost"]),
    ).rejects.toThrow(/was not found/i);
    expect(db.opportunity.update).not.toHaveBeenCalled();
  });

  it("validates every id before writing any of them", async () => {
    // Order matters: a partial renumber would leave the column in a state
    // neither the caller nor the previous order describes.
    db.opportunity.findMany.mockResolvedValue([
      { id: "opp1", stage: "proposal" },
      { id: "opp2", stage: "proposal" },
      { id: "opp3", stage: "live" },
    ]);

    await expect(
      opportunityRepository.reorderWithinStage("proposal", [
        "opp1",
        "opp2",
        "opp3",
      ]),
    ).rejects.toThrow(/not in stage/i);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("writes nothing for an empty list", async () => {
    expect(
      await opportunityRepository.reorderWithinStage("proposal", []),
    ).toEqual({ success: true, reordered: 0 });
    expect(db.opportunity.findMany).not.toHaveBeenCalled();
  });
});
