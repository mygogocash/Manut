import { beforeEach, describe, expect, it, vi } from "vitest";

import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import { opportunityService } from "@/modules/opportunities/opportunities.service";

/**
 * The invariant this file exists to protect.
 *
 * A bulk business-unit assignment MUST go through the single-record
 * `OpportunityService.update`, because that is what routes into
 * `syncBusinessUnitsAfterWrite` — which decides whether a deal is being
 * SEEDED from itself (no child rows yet) or is GAINING a unit (rows already
 * there), then pushes deal fields down, then recomputes the roll-up, in that
 * order.
 *
 * Replacing the loop with a `prisma.opportunity.updateMany` on the tag array
 * would be much faster and would leave every newly tagged unit with no
 * `crm_opportunity_business_units` row — invisible on the per-unit board — and
 * the deal's derived fields stale. That is the exact corruption PR1 was
 * reverted for, so the delegation is asserted rather than assumed.
 */

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const ACTOR = "11111111-1111-1111-1111-111111111111";
const TEAM = ["crm:read", "crm:update", "crm:team-read"];

function stubRows(rows: Array<{ id: string; businessUnits: string[] }>) {
  return vi
    .spyOn(opportunityRepository, "findIdsAndUnits")
    .mockResolvedValue(rows);
}

function stubUpdate() {
  return vi.spyOn(opportunityService, "update").mockResolvedValue({} as never);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("bulkUpdateBusinessUnits — delegation", () => {
  it("routes every changed deal through update(), not a bulk array write", async () => {
    stubRows([
      { id: "no-rows-yet", businessUnits: [] },
      { id: "already-has-rows", businessUnits: ["aria"] },
    ]);
    const update = stubUpdate();

    const result = await opportunityService.bulkUpdateBusinessUnits(
      ACTOR,
      TEAM,
      {
        ids: ["no-rows-yet", "already-has-rows"],
        businessUnits: { mode: "add", codes: ["onewave"] },
      } as never,
    );

    expect(result).toMatchObject({ selected: 2, updated: 2, skipped: 0 });

    // The untagged deal — ensureBusinessUnitRows will SEED from the deal.
    expect(update).toHaveBeenCalledWith("no-rows-yet", ACTOR, TEAM, {
      businessUnits: ["onewave"],
    });
    // The already-tagged deal — ensureBusinessUnitRows will SYNC (add one row),
    // a different rule that looks alike. Both must reach the same method.
    expect(update).toHaveBeenCalledWith("already-has-rows", ACTOR, TEAM, {
      businessUnits: ["aria", "onewave"],
    });
  });

  it("passes the actor's own permissions through, so per-row authz still runs", async () => {
    stubRows([{ id: "a", businessUnits: [] }]);
    const update = stubUpdate();

    await opportunityService.bulkUpdateBusinessUnits(ACTOR, TEAM, {
      ids: ["a"],
      businessUnits: { mode: "add", codes: ["onewave"] },
    } as never);

    const [, userId, permissions] = update.mock.calls[0]!;
    expect(userId).toBe(ACTOR);
    expect(permissions).toBe(TEAM);
  });

  it("does not call update for a deal already carrying the unit", async () => {
    // Skipping matters here specifically: a write means a per-unit reconcile
    // plus a roll-up recompute.
    stubRows([{ id: "done", businessUnits: ["onewave"] }]);
    const update = stubUpdate();

    const result = await opportunityService.bulkUpdateBusinessUnits(
      ACTOR,
      TEAM,
      {
        ids: ["done"],
        businessUnits: { mode: "add", codes: ["onewave"] },
      } as never,
    );

    expect(result).toMatchObject({ updated: 0, skipped: 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports a per-row failure without aborting the batch", async () => {
    stubRows([
      { id: "ok-1", businessUnits: [] },
      { id: "boom", businessUnits: [] },
      { id: "ok-2", businessUnits: [] },
    ]);
    vi.spyOn(opportunityService, "update")
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("Opportunity not found"))
      .mockResolvedValueOnce({} as never);

    const result = await opportunityService.bulkUpdateBusinessUnits(
      ACTOR,
      TEAM,
      {
        ids: ["ok-1", "boom", "ok-2"],
        businessUnits: { mode: "add", codes: ["onewave"] },
      } as never,
    );

    expect(result.updated).toBe(2);
    expect(result.failed).toEqual([
      { id: "boom", reason: "Opportunity not found" },
    ]);
  });
});

describe("bulkUpdateBusinessUnits — selection scoping", () => {
  it("owner-scopes the query for a caller without crm:team-read", async () => {
    const find = stubRows([]);
    stubUpdate();

    await opportunityService.bulkUpdateBusinessUnits(
      ACTOR,
      ["crm:read", "crm:update"], // no crm:team-read
      {
        ids: ["someone-elses-deal"],
        businessUnits: { mode: "add", codes: ["onewave"] },
      } as never,
    );

    // A foreign id simply matches nothing — no error, no partial write.
    expect(find).toHaveBeenCalledWith(
      { id: { in: ["someone-elses-deal"] }, ownerId: { in: [ACTOR] } },
      expect.any(Number),
    );
  });

  it("does not owner-scope a caller holding crm:team-read", async () => {
    const find = stubRows([]);
    stubUpdate();

    await opportunityService.bulkUpdateBusinessUnits(ACTOR, TEAM, {
      ids: ["any-deal"],
      businessUnits: { mode: "add", codes: ["onewave"] },
    } as never);

    expect(find).toHaveBeenCalledWith(
      { id: { in: ["any-deal"] } },
      expect.any(Number),
    );
  });

  it("allMatching resolves through the list where-builder, carrying the Unassigned sentinel", async () => {
    const find = stubRows([]);
    stubUpdate();

    await opportunityService.bulkUpdateBusinessUnits(ACTOR, TEAM, {
      allMatching: true,
      filter: { businessUnit: "__none__" },
      businessUnits: { mode: "add", codes: ["onewave"] },
    } as never);

    // buildOpportunityWhere turns the sentinel into `isEmpty` — proving the
    // bulk path did not rebuild the predicate itself.
    const [where] = find.mock.calls[0]!;
    expect(where).toMatchObject({ businessUnits: { isEmpty: true } });
  });

  it("refuses an over-large selection rather than truncating it", async () => {
    // The repo fetches cap+1 so the service can tell "at the cap" from "over".
    stubRows(
      Array.from({ length: 501 }, (_, i) => ({
        id: `d${i}`,
        businessUnits: [],
      })),
    );
    const update = stubUpdate();

    await expect(
      opportunityService.bulkUpdateBusinessUnits(ACTOR, TEAM, {
        allMatching: true,
        filter: {},
        businessUnits: { mode: "add", codes: ["onewave"] },
      } as never),
    ).rejects.toThrow(/too large/i);

    expect(update).not.toHaveBeenCalled();
  });
});
