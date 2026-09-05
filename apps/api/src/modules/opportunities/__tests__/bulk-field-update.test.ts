import { beforeEach, describe, expect, it, vi } from "vitest";

import { leadService } from "@/modules/leads/leads.service";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import { opportunityService } from "@/modules/opportunities/opportunities.service";

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const ACTOR = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const UPDATE_ONLY = ["crm:read", "crm:update", "crm:team-read"];
const WITH_REASSIGN = [...UPDATE_ONLY, "crm:reassign"];

function rows(
  list: Array<{
    id: string;
    ownerId?: string;
    archivedAt?: Date | null;
    stage?: string;
  }>,
) {
  return vi
    .spyOn(opportunityRepository, "findIdsForFieldSet")
    .mockResolvedValue(
      list.map((r) => ({
        id: r.id,
        ownerId: r.ownerId ?? ACTOR,
        archivedAt: r.archivedAt ?? null,
        stage: r.stage ?? "qualified",
      })),
    );
}

beforeEach(() => vi.restoreAllMocks());

describe("bulkUpdateFields — the crm:reassign gate", () => {
  it("refuses an owner change without crm:reassign", async () => {
    // requirePermission on the route cannot express "only when ownerId is
    // present", so this guard has to live in the service.
    const find = rows([{ id: "a" }]);

    await expect(
      opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
        ids: ["a"],
        set: { ownerId: OTHER },
      } as never),
    ).rejects.toThrow(/crm:reassign/);

    // Refused before touching the database.
    expect(find).not.toHaveBeenCalled();
  });

  it("allows an owner change with crm:reassign", async () => {
    rows([{ id: "a", ownerId: ACTOR }]);
    const update = vi
      .spyOn(opportunityService, "update")
      .mockResolvedValue({} as never);

    const res = await opportunityService.bulkUpdateFields(
      ACTOR,
      WITH_REASSIGN,
      {
        ids: ["a"],
        set: { ownerId: OTHER },
      } as never,
    );

    expect(res).toMatchObject({ updated: 1, skipped: 0 });
    expect(update).toHaveBeenCalledWith("a", ACTOR, WITH_REASSIGN, {
      ownerId: OTHER,
    });
  });

  it("allows archiving with crm:update alone", async () => {
    rows([{ id: "a" }]);
    const archive = vi
      .spyOn(opportunityService, "archive")
      .mockResolvedValue({} as never);

    const res = await opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
      ids: ["a"],
      set: { archived: true },
    } as never);

    expect(res.updated).toBe(1);
    expect(archive).toHaveBeenCalledWith("a", ACTOR, UPDATE_ONLY);
  });

  it("unarchives through the single-record method", async () => {
    rows([{ id: "a", archivedAt: new Date() }]);
    const unarchive = vi
      .spyOn(opportunityService, "unarchive")
      .mockResolvedValue({} as never);

    await opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
      ids: ["a"],
      set: { archived: false },
    } as never);

    expect(unarchive).toHaveBeenCalledWith("a", ACTOR, UPDATE_ONLY);
  });

  it("refuses an over-large selection before writing", async () => {
    rows(Array.from({ length: 501 }, (_, i) => ({ id: `d${i}` })));
    const archive = vi.spyOn(opportunityService, "archive");

    await expect(
      opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
        allMatching: true,
        filter: {},
        set: { archived: true },
      } as never),
    ).rejects.toThrow(/too large/i);
    expect(archive).not.toHaveBeenCalled();
  });
});

describe("bulkUpdateFields — leads cannot reassign owner", () => {
  it("refuses at the writer, because updateLeadSchema has no ownerId", async () => {
    // A lead's owner is fixed at creation and can only move during convert
    // (PRD §11.1). Bulk must not invent the capability, so the schema omits the
    // field and the writer refuses if it is ever reached.
    const svc = leadService as unknown as {
      bulkUpdateFields: (
        u: string,
        p: string[],
        i: unknown,
      ) => Promise<{ failed: Array<{ reason: string }> }>;
    };

    vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("@/modules/leads/leads.repository")).leadRepository as any,
      "findIdsForFieldSet",
    ).mockResolvedValue([{ id: "l1", ownerId: ACTOR, archivedAt: null }]);

    const res = await svc.bulkUpdateFields(ACTOR, WITH_REASSIGN, {
      ids: ["l1"],
      // Bypasses zod (which would reject it) to prove the writer is the
      // second line of defence.
      set: { ownerId: OTHER },
    });

    expect(res.failed[0]?.reason).toMatch(/cannot be reassigned/i);
  });
});

describe("bulkUpdateFields — stage", () => {
  it("SUPPRESSES the per-deal stage-change email", async () => {
    // The whole reason `update` gained an options bag: moving fifty deals would
    // otherwise send fifty emails to the BD distribution list.
    rows([{ id: "a" }]);
    const update = vi
      .spyOn(opportunityService, "update")
      .mockResolvedValue({} as never);

    await opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
      ids: ["a"],
      set: { stage: "proposal" },
    } as never);

    expect(update).toHaveBeenCalledWith(
      "a",
      ACTOR,
      UPDATE_ONLY,
      { stage: "proposal" },
      { suppressNotifications: true },
    );
  });

  it("skips a deal already at the target stage", async () => {
    rows([{ id: "a", stage: "proposal" }]);
    const update = vi.spyOn(opportunityService, "update");

    const res = await opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
      ids: ["a"],
      set: { stage: "proposal" },
    } as never);

    expect(res).toMatchObject({ updated: 0, skipped: 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports a guard refusal rather than bypassing it", async () => {
    rows([{ id: "won", stage: "closed_won" }]);
    vi.spyOn(opportunityService, "update").mockRejectedValue(
      new Error("Cannot mark a closed_won opportunity as lost. Reopen first."),
    );

    const res = await opportunityService.bulkUpdateFields(ACTOR, UPDATE_ONLY, {
      ids: ["won"],
      set: { stage: "qualified" },
    } as never);

    expect(res.updated).toBe(0);
    expect(res.failed[0]?.reason).toMatch(/Reopen first/);
  });
});

describe("BULK_SETTABLE_STAGES", () => {
  it("excludes every terminal stage", async () => {
    // closed_lost needs a lost reason; closed_won and live are milestones with
    // dates a flat bulk set cannot supply. And `update()` carries no terminal
    // guard, so allowing them here would let one click move fifty won deals to
    // lost with no reason recorded.
    const { BULK_SETTABLE_STAGES } =
      await import("@/modules/crm-shared/bulk-validation");
    expect([...BULK_SETTABLE_STAGES]).toEqual([
      "qualified",
      "proposal",
      "negotiation",
    ]);
    for (const terminal of ["closed_won", "closed_lost", "live"]) {
      expect(BULK_SETTABLE_STAGES).not.toContain(terminal);
    }
  });
});
