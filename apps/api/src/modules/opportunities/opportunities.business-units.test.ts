import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUSINESS_UNIT_UNASSIGNED } from "@/modules/business-units/business-units.validation";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";

// The business-unit filter is built in the repository, so mock prisma and
// assert the exact `where.businessUnits` shape on BOTH findMany and count —
// a mismatch would report a total the paginated view can never reach.
// `vi.mock` is hoisted above these imports, so the repository sees the mock.
const db = vi.hoisted(() => ({
  opportunity: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

beforeEach(() => {
  vi.clearAllMocks();
  db.opportunity.findMany.mockResolvedValue([]);
  db.opportunity.count.mockResolvedValue(0);
  db.opportunity.groupBy.mockResolvedValue([]);
});

describe("opportunity list — business-unit filter", () => {
  it("narrows to records carrying the code, on findMany + count", async () => {
    await opportunityRepository.findMany({ businessUnit: "onewave" }, 1, 20);

    expect(
      db.opportunity.findMany.mock.calls[0][0].where.businessUnits,
    ).toEqual({ has: "onewave" });
    expect(db.opportunity.count.mock.calls[0][0].where.businessUnits).toEqual({
      has: "onewave",
    });
  });

  it("narrows to untagged records for the Unassigned sentinel", async () => {
    await opportunityRepository.findMany(
      { businessUnit: BUSINESS_UNIT_UNASSIGNED },
      1,
      20,
    );

    expect(
      db.opportunity.findMany.mock.calls[0][0].where.businessUnits,
    ).toEqual({ isEmpty: true });
    expect(db.opportunity.count.mock.calls[0][0].where.businessUnits).toEqual({
      isEmpty: true,
    });
  });

  it("leaves the key off entirely when no unit is selected", async () => {
    await opportunityRepository.findMany({}, 1, 20);

    expect(
      db.opportunity.findMany.mock.calls[0][0].where.businessUnits,
    ).toBeUndefined();
  });
});

describe("pipelineSummary — header rollup matches the filtered cards", () => {
  it("applies the business-unit filter to the per-stage rollup", async () => {
    await opportunityRepository.pipelineSummary({}, { businessUnit: "aria" });

    const where = db.opportunity.groupBy.mock.calls[0][0].where;
    expect(where.businessUnits).toEqual({ has: "aria" });
    // The board is the Active view, so the rollup always excludes archived
    // rows regardless of what the caller passed.
    expect(where.archivedAt).toBeNull();
  });

  it("applies the geo + owner filters the board already had", async () => {
    await opportunityRepository.pipelineSummary(
      {},
      { country: "Thailand", region: "APAC", ownerId: "user-1" },
    );

    const where = db.opportunity.groupBy.mock.calls[0][0].where;
    expect(where.account).toEqual({ country: "Thailand", region: "APAC" });
    expect(where.ownerId).toBe("user-1");
  });

  it("still honours owner scoping for a rep without crm:team-read", async () => {
    await opportunityRepository.pipelineSummary({ ownerScope: ["me"] });

    expect(db.opportunity.groupBy.mock.calls[0][0].where.ownerId).toEqual({
      in: ["me"],
    });
  });
});
