import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { accountRepository } from "@/modules/accounts/accounts.repository";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import { OpportunityService } from "@/modules/opportunities/opportunities.service";
import {
  ensureBusinessUnitRows,
  pushDealFieldsToBusinessUnits,
  recomputeOpportunityRollup,
} from "@/modules/opportunities/opportunity-business-units.repository";

vi.mock("@/modules/accounts/accounts.repository", () => ({
  accountRepository: { findById: vi.fn() },
}));

vi.mock("@/modules/contacts/contacts.repository", () => ({
  contactRepository: { findById: vi.fn() },
}));

vi.mock("@/modules/opportunities/opportunities.repository", () => ({
  opportunityRepository: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findStageConfig: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: () => ({
    resolveRate: vi.fn(async () => ({ rate: 1, source: "identity" })),
  }),
}));

// The child-row adapter. Every assertion below is about WHICH of these the
// service calls, with what, and — critically — in what order.
vi.mock(
  "@/modules/opportunities/opportunity-business-units.repository",
  () => ({
    ensureBusinessUnitRows: vi.fn(),
    pushDealFieldsToBusinessUnits: vi.fn(),
    recomputeOpportunityRollup: vi.fn(),
  }),
);

const findAccount = accountRepository.findById as Mock;
const findById = opportunityRepository.findById as Mock;
const create = opportunityRepository.create as Mock;
const update = opportunityRepository.update as Mock;
const ensure = ensureBusinessUnitRows as Mock;
const pushDown = pushDealFieldsToBusinessUnits as Mock;
const recompute = recomputeOpportunityRollup as Mock;

const service = new OpportunityService();

/** Order of adapter calls, so "push down BEFORE recompute" is assertable. */
let calls: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  calls = [];

  findAccount.mockResolvedValue({ id: "acc1", ownerId: "user1" });
  ensure.mockImplementation(async () => {
    calls.push("ensure");
    return { mode: "synced", added: [], removed: [] };
  });
  pushDown.mockImplementation(async () => {
    calls.push("pushDown");
  });
  recompute.mockImplementation(async () => {
    calls.push("recompute");
  });
});

const TAGGED = {
  id: "opp1",
  name: "MTN",
  stage: "negotiation",
  probability: 60,
  probabilityCustom: false,
  value: 500000,
  currency: "USD",
  businessUnits: ["onewave", "onewave-revenue"],
  closeDate: null,
  launchDate: null,
  revenueLaunchDate: null,
  lostReason: null,
  ownerId: "user1",
  account: { id: "acc1", ownerId: "user1" },
};

const ALL = ["crm:team-read", "crm:update", "crm:create"];

describe("create", () => {
  it("seeds the child rows and returns the post-roll-up row", async () => {
    // The row captured from `create` predates the recompute, which writes
    // the derived deal fields on the SAME row. Returning it unrefreshed
    // hands the caller — and the "new deal" email — a pre-roll-up stage.
    create.mockResolvedValue({ ...TAGGED, stage: "negotiation" });
    findById.mockResolvedValue({ ...TAGGED, stage: "proposal" });

    const result = await service.create("user1", ALL, {
      name: "MTN",
      accountId: "acc1",
      stage: "negotiation",
      value: 500000,
      currency: "USD",
      businessUnits: ["onewave", "onewave-revenue"],
    } as never);

    expect(ensure).toHaveBeenCalledWith("opp1", ["onewave", "onewave-revenue"]);
    expect(recompute).toHaveBeenCalledWith("opp1");
    expect(result.stage).toBe("proposal");
  });

  it("does not push deal fields down on a freshly seeded deal", async () => {
    // The seeded rows ARE the deal, so there is nothing to push; doing it
    // anyway would re-split a value that is already correct.
    ensure.mockImplementation(async () => {
      calls.push("ensure");
      return { mode: "seeded", added: ["onewave"], removed: [] };
    });
    create.mockResolvedValue(TAGGED);
    findById.mockResolvedValue(TAGGED);

    await service.create("user1", ALL, {
      name: "MTN",
      accountId: "acc1",
      stage: "negotiation",
      value: 500000,
      currency: "USD",
      businessUnits: ["onewave"],
    } as never);

    expect(pushDown).not.toHaveBeenCalled();
  });

  it("still calls the adapter for an untagged deal", async () => {
    // ensureBusinessUnitRows is a documented no-op for a deal with no tags
    // and no rows. Branching in the service instead would put the same
    // decision in two places.
    create.mockResolvedValue({ ...TAGGED, businessUnits: [] });
    findById.mockResolvedValue({ ...TAGGED, businessUnits: [] });

    await service.create("user1", ALL, {
      name: "MTN",
      accountId: "acc1",
      stage: "qualified",
      value: 0,
      currency: "USD",
    } as never);

    expect(ensure).toHaveBeenCalledWith("opp1", []);
  });
});

describe("update", () => {
  it("pushes the edit down BEFORE recomputing", async () => {
    // The ordering IS the fix. Recompute reads the child rows; if the edit
    // has not landed on them yet it reads stale rows and overwrites the
    // rep's change with an outdated roll-up.
    findById.mockResolvedValue(TAGGED);
    update.mockResolvedValue(TAGGED);

    await service.update("opp1", "user1", ALL, {
      value: 600000,
    } as never);

    expect(calls.indexOf("pushDown")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("pushDown")).toBeLessThan(calls.indexOf("recompute"));
  });

  it("pushes only the fields that were edited", async () => {
    findById.mockResolvedValue(TAGGED);
    update.mockResolvedValue(TAGGED);

    await service.update("opp1", "user1", ALL, {
      stage: "closed_won",
    } as never);

    const patch = pushDown.mock.calls[0][1];
    expect(patch.stage).toBe("closed_won");
    expect(patch.value).toBeUndefined();
    expect(patch.closeDate).toBeUndefined();
  });

  it("syncs the child rows when the tag set changes", async () => {
    findById.mockResolvedValue(TAGGED);
    update.mockResolvedValue({ ...TAGGED, businessUnits: ["onewave"] });

    await service.update("opp1", "user1", ALL, {
      businessUnits: ["onewave"],
    } as never);

    expect(ensure).toHaveBeenCalledWith("opp1", ["onewave"]);
  });

  it("does not touch the child rows when nothing per-unit changed", async () => {
    // A rename must not push anything down or trigger a recompute.
    //
    // `ensure` IS expected here, once: update reads the deal through
    // getById, which lazily heals the child rows. That call is idempotent
    // and reports no change for a deal already in step, so it must not
    // cascade into a recompute.
    findById.mockResolvedValue(TAGGED);
    update.mockResolvedValue(TAGGED);

    await service.update("opp1", "user1", ALL, {
      name: "MTN Group",
    } as never);

    expect(pushDown).not.toHaveBeenCalled();
    expect(recompute).not.toHaveBeenCalled();
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("heals a tagged deal that has no child rows when it is read", async () => {
    // The lazy seed replacing the boot backfill. A deal predating the child
    // tables gets its rows on first open rather than from a bulk writer
    // racing live traffic. Seeded rows reproduce the deal, so the roll-up
    // is the identity and no recompute is needed.
    ensure.mockImplementation(async () => {
      calls.push("ensure");
      return { mode: "seeded", added: ["onewave"], removed: [] };
    });
    findById.mockResolvedValue(TAGGED);

    await service.getById("opp1", "user1", ALL);

    expect(ensure).toHaveBeenCalledWith("opp1", ["onewave", "onewave-revenue"]);
    expect(recompute).not.toHaveBeenCalled();
  });

  it("recomputes when the read-path heal actually drops a stale unit", async () => {
    // A sync that removed a row DOES change what the deal should report,
    // so this one has to recompute and re-read.
    ensure.mockImplementation(async () => {
      calls.push("ensure");
      return { mode: "synced", added: [], removed: ["aria"] };
    });
    findById.mockResolvedValue(TAGGED);

    await service.getById("opp1", "user1", ALL);

    expect(recompute).toHaveBeenCalledWith("opp1");
  });
});

describe("closeLost", () => {
  it("settles every unit, not just the least-advanced one", async () => {
    // closed_lost sorts last, so pushing it onto one unit would leave a
    // sibling defining the roll-up and the deal would not read as lost.
    findById.mockResolvedValue(TAGGED);
    update.mockResolvedValue({ ...TAGGED, stage: "closed_lost" });

    await service.closeLost("opp1", "user1", ALL, {
      lostReason: "price",
    } as never);

    const options = pushDown.mock.calls[0][2];
    expect(options.stageAppliesToEveryUnit).toBe(true);
    const patch = pushDown.mock.calls[0][1];
    expect(patch.stage).toBe("closed_lost");
    expect(patch.lostReason).toBe("price");
  });

  it("runs the push-down after the write, not before", async () => {
    // Pushing before the repository write would recompute against the old
    // deal row — the ordering trap the TODO called out explicitly.
    findById.mockResolvedValue(TAGGED);
    update.mockImplementation(async () => {
      calls.push("update");
      return { ...TAGGED, stage: "closed_lost" };
    });

    await service.closeLost("opp1", "user1", ALL, {
      lostReason: "price",
    } as never);

    expect(calls.indexOf("update")).toBeLessThan(calls.indexOf("pushDown"));
    expect(calls.indexOf("pushDown")).toBeLessThan(calls.indexOf("recompute"));
  });
});

describe("reopen", () => {
  it("pulls every unit back into the active pipeline", async () => {
    findById.mockResolvedValue({ ...TAGGED, stage: "closed_lost" });
    update.mockResolvedValue({ ...TAGGED, stage: "proposal" });

    await service.reopen("opp1", "user1", ALL, {
      stage: "proposal",
    } as never);

    const options = pushDown.mock.calls[0][2];
    expect(options.stageAppliesToEveryUnit).toBe(true);
    const patch = pushDown.mock.calls[0][1];
    expect(patch.stage).toBe("proposal");
    expect(patch.lostReason).toBeNull();
  });
});
