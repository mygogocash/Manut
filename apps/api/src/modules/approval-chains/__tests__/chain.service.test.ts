import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { chainService } from "@/modules/approval-chains/chain.service";
import {
  CHAIN_SCOPE,
  DECISION_STATUS,
} from "@/modules/approval-chains/chain.types";

vi.mock("@/infrastructure/database/prisma", () => {
  const client: Record<string, unknown> = {
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => Promise<unknown>)(client)
        : Promise.resolve(arg),
    ),
    approvalChain: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn((args) => ({ id: "c1", ...args.data })),
    },
    approvalChainStep: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn((args) => ({ id: "s-new", ...args.data })),
      update: vi.fn((args) => ({ id: args.where.id, ...args.data })),
      delete: vi.fn(),
    },
    approvalChainDecision: {
      findMany: vi.fn(),
      createMany: vi.fn(() => ({ count: 0 })),
      updateMany: vi.fn(() => ({ count: 1 })),
      deleteMany: vi.fn(() => ({ count: 0 })),
    },
    user: { findMany: vi.fn(() => []) },
  };
  return { prisma: client };
});

type M = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  $transaction: M;
  approvalChain: { findUnique: M; findMany: M; create: M; update: M };
  approvalChainStep: {
    findUnique: M;
    findFirst: M;
    findMany: M;
    count: M;
    create: M;
    update: M;
    delete: M;
  };
  approvalChainDecision: {
    findMany: M;
    createMany: M;
    updateMany: M;
    deleteMany: M;
  };
  user: { findMany: M };
};

const ALICE = {
  id: "u-alice",
  name: "Alice",
  email: "a@x.com",
  isActive: true,
};
const BOB = { id: "u-bob", name: "Bob", email: "b@x.com", isActive: true };
const GONE = { id: "u-gone", name: "Gone", email: "g@x.com", isActive: false };

/** A configured stage as the repository returns it. */
function step(
  order: number,
  name: string,
  approver: typeof ALICE | null,
  isActive = true,
  isSystem = false,
) {
  return {
    id: `s${order}`,
    order,
    name,
    description: null,
    approverUserId: approver?.id ?? null,
    isActive,
    isSystem,
    approverUser: approver,
  };
}

/** A snapshotted stage as the repository returns it. */
function decision(
  order: number,
  status: string,
  approver: typeof ALICE | null = ALICE,
) {
  return {
    id: `d${order}`,
    order,
    name: `Stage ${order}`,
    status,
    approverUserId: approver?.id ?? null,
    decidedById: null,
    decidedAt: null,
    notes: null,
    approverUser: approver,
    decidedBy: null,
  };
}

const chainWith = (steps: ReturnType<typeof step>[], isActive = true) => ({
  id: "c1",
  scope: CHAIN_SCOPE.PROPOSAL,
  name: "Proposal approval",
  description: null,
  isActive,
  steps,
});

const OWNER = { proposalId: "p1" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(db)
      : Promise.resolve(arg),
  );
  db.approvalChainStep.create.mockImplementation((args: { data: object }) => ({
    id: "s-new",
    ...args.data,
  }));
  db.approvalChainStep.update.mockImplementation(
    (args: { where: { id: string }; data: object }) => ({
      id: args.where.id,
      ...args.data,
    }),
  );
  db.approvalChainDecision.createMany.mockResolvedValue({ count: 0 });
  db.approvalChainDecision.updateMany.mockResolvedValue({ count: 1 });
  db.user.findMany.mockResolvedValue([]);
});

// ── Reading configuration ──
describe("reading a chain", () => {
  it("separates 'nobody configured' from 'configured but gone'", async () => {
    db.approvalChain.findUnique.mockResolvedValue(
      chainWith([step(1, "First", null), step(2, "Final", GONE)]),
    );
    const chain = await chainService.getChain(CHAIN_SCOPE.PROPOSAL);

    // Never configured: no approver, and nothing for an admin to repair.
    expect(chain!.steps[0]!.approver).toBeNull();
    expect(chain!.steps[0]!.approverMissing).toBe(false);

    // Configured but deactivated: the admin needs to know the name is stale.
    expect(chain!.steps[1]!.approver).toBeNull();
    expect(chain!.steps[1]!.approverMissing).toBe(true);
  });
});

// ── The empty-chain rule ──
//
// A chain with no active stage would mean "submitted equals approved". Far more
// likely a mistake than an intention, so the API refuses to save it.
describe("a chain cannot be emptied", () => {
  it("refuses to delete the last active stage", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue({
      ...step(1, "Only", ALICE),
      chainId: "c1",
    });
    db.approvalChainStep.count.mockResolvedValue(1);

    await expect(chainService.removeStep("s1")).rejects.toThrow(
      /at least one active stage/i,
    );
    expect(db.approvalChainStep.delete).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the last active stage", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue({
      ...step(1, "Only", ALICE),
      chainId: "c1",
    });
    db.approvalChainStep.count.mockResolvedValue(1);

    await expect(
      chainService.updateStep("s1", { isActive: false }),
    ).rejects.toThrow(/at least one active stage/i);
    expect(db.approvalChainStep.update).not.toHaveBeenCalled();
  });

  it("allows deleting a stage when others remain", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue({
      ...step(1, "First", ALICE),
      chainId: "c1",
    });
    db.approvalChainStep.count.mockResolvedValue(2);
    db.approvalChainStep.findMany.mockResolvedValue([step(2, "Final", BOB)]);

    await expect(chainService.removeStep("s1")).resolves.toEqual({
      removed: true,
    });
    expect(db.approvalChainStep.delete).toHaveBeenCalled();
  });
});

// ── The fixed-stage rule ──
//
// The stages the flow was decided with are not an administrator's to delete.
// Who approves at them is configurable — that is the point — but whether they
// exist is not. Stages added afterwards are ordinary and go freely.
describe("a stage of the decided flow cannot be removed", () => {
  const systemStep = {
    ...step(1, "First review", ALICE, true, true),
    chainId: "c1",
  };

  it("refuses to delete it even when other stages remain", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue(systemStep);
    db.approvalChainStep.count.mockResolvedValue(3);

    await expect(chainService.removeStep("s1")).rejects.toThrow(
      /part of the approval flow/i,
    );
    expect(db.approvalChainStep.delete).not.toHaveBeenCalled();
  });

  it("refuses to deactivate it, which would remove it in all but name", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue(systemStep);
    db.approvalChainStep.count.mockResolvedValue(3);

    await expect(
      chainService.updateStep("s1", { isActive: false }),
    ).rejects.toThrow(/part of the approval flow/i);
    expect(db.approvalChainStep.update).not.toHaveBeenCalled();
  });

  // The whole reason for chains: a fixed stage still has to be staffable.
  it("still allows renaming it and changing who approves there", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue(systemStep);
    db.approvalChain.findUnique.mockResolvedValue(
      chainWith([step(1, "Commercial review", BOB, true, true)]),
    );

    await chainService.updateStep("s1", {
      name: "Commercial review",
      approverUserId: BOB.id,
    });
    expect(db.approvalChainStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({
          name: "Commercial review",
          approverUserId: BOB.id,
        }),
      }),
    );
  });

  it("lets an added stage be deleted", async () => {
    db.approvalChainStep.findUnique.mockResolvedValue({
      ...step(3, "Added later", BOB),
      chainId: "c1",
    });
    db.approvalChainStep.count.mockResolvedValue(3);
    db.approvalChainStep.findMany.mockResolvedValue([step(1, "First", ALICE)]);

    await expect(chainService.removeStep("s3")).resolves.toEqual({
      removed: true,
    });
    expect(db.approvalChainStep.delete).toHaveBeenCalled();
  });

  it("reports it on the read, so the UI can hide the control", async () => {
    db.approvalChain.findUnique.mockResolvedValue(
      chainWith([step(1, "First", ALICE, true, true), step(2, "Added", BOB)]),
    );
    const chain = await chainService.getChain(CHAIN_SCOPE.PROPOSAL);
    expect(chain!.steps.map((s) => s.isSystem)).toEqual([true, false]);
  });
});

// ── Reordering ──
describe("reordering", () => {
  beforeEach(() => {
    db.approvalChain.findUnique.mockResolvedValue(
      chainWith([step(1, "A", ALICE), step(2, "B", BOB)]),
    );
    db.approvalChainStep.findMany.mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
    ]);
  });

  it("refuses a partial list, which would strand stages at their old order", async () => {
    await expect(
      chainService.reorderSteps(CHAIN_SCOPE.PROPOSAL, ["s1"]),
    ).rejects.toThrow(/every stage/i);
  });

  it("refuses a list naming the same stage twice", async () => {
    await expect(
      chainService.reorderSteps(CHAIN_SCOPE.PROPOSAL, ["s1", "s1"]),
    ).rejects.toThrow(/every stage/i);
  });

  it("parks rows high before renumbering, so the unique index never clashes", async () => {
    await chainService.reorderSteps(CHAIN_SCOPE.PROPOSAL, ["s2", "s1"]);
    const orders = db.approvalChainStep.update.mock.calls.map(
      (c: [{ data: { order: number } }]) => c[0].data.order,
    );
    // First pass parks in the 10_000 range, second renumbers to 1..N.
    expect(orders.slice(0, 2).every((o: number) => o >= 10_000)).toBe(true);
    expect(orders.slice(2)).toEqual([1, 2]);
  });
});

// ── Snapshotting ──
describe("snapshotting a chain onto a record", () => {
  it("copies the active stages in order", async () => {
    db.approvalChain.findUnique.mockResolvedValue(
      chainWith([step(1, "First", ALICE), step(2, "Final", BOB)]),
    );
    db.approvalChainStep.findMany.mockResolvedValue([
      step(1, "First", ALICE),
      step(2, "Final", BOB),
    ]);

    const res = await chainService.snapshot(
      db as never,
      CHAIN_SCOPE.PROPOSAL,
      OWNER,
    );
    expect(res).toEqual({ stages: 2, firstOrder: 1 });

    const rows = db.approvalChainDecision.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { order: number }) => r.order)).toEqual([1, 2]);
    expect(rows.every((r: { status: string }) => r.status === "pending")).toBe(
      true,
    );
  });

  it("renumbers over inactive stages so progress has no hole", async () => {
    db.approvalChain.findUnique.mockResolvedValue(chainWith([]));
    // Stage 2 is parked, so the active stages are configured 1 and 3.
    db.approvalChainStep.findMany.mockResolvedValue([
      step(1, "First", ALICE),
      step(3, "Third", BOB),
    ]);

    await chainService.snapshot(db as never, CHAIN_SCOPE.PROPOSAL, OWNER);
    const rows = db.approvalChainDecision.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { order: number }) => r.order)).toEqual([1, 2]);
    expect(rows.map((r: { name: string }) => r.name)).toEqual([
      "First",
      "Third",
    ]);
  });

  it("does not carry a deactivated approver onto the record", async () => {
    db.approvalChain.findUnique.mockResolvedValue(chainWith([]));
    db.approvalChainStep.findMany.mockResolvedValue([step(1, "First", GONE)]);

    await chainService.snapshot(db as never, CHAIN_SCOPE.PROPOSAL, OWNER);
    const rows = db.approvalChainDecision.createMany.mock.calls[0][0].data;
    expect(rows[0].approverUserId).toBeNull();
  });

  // Zero stages must NOT read as approved. The caller falls back to its coded
  // default; treating it as complete would auto-approve on a misconfiguration.
  it("reports zero stages when no chain is active, writing nothing", async () => {
    db.approvalChain.findUnique.mockResolvedValue(chainWith([], false));

    const res = await chainService.snapshot(
      db as never,
      CHAIN_SCOPE.PROPOSAL,
      OWNER,
    );
    expect(res).toEqual({ stages: 0, firstOrder: null });
    expect(db.approvalChainDecision.createMany).not.toHaveBeenCalled();
  });

  it("reports zero stages when every stage is inactive", async () => {
    db.approvalChain.findUnique.mockResolvedValue(chainWith([]));
    db.approvalChainStep.findMany.mockResolvedValue([]);

    const res = await chainService.snapshot(
      db as never,
      CHAIN_SCOPE.PROPOSAL,
      OWNER,
    );
    expect(res.stages).toBe(0);
    expect(db.approvalChainDecision.createMany).not.toHaveBeenCalled();
  });
});

// ── The reason the snapshot exists ──
describe("editing a chain never moves a record already in flight", () => {
  it("reads progress from the snapshot, not from the live chain", async () => {
    // The record was snapshotted against a two-stage chain and is at stage 2.
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.APPROVED),
      decision(2, DECISION_STATUS.PENDING, BOB),
    ]);
    // Meanwhile an admin has rewritten the chain entirely: one stage, new person.
    db.approvalChain.findUnique.mockResolvedValue(
      chainWith([step(1, "Rewritten", ALICE)]),
    );
    db.approvalChainStep.findMany.mockResolvedValue([
      step(1, "Rewritten", ALICE),
    ]);

    const progress = await chainService.progress(OWNER);
    expect(progress.totalStages).toBe(2);
    expect(progress.currentOrder).toBe(2);
    expect(progress.decisions[1]!.approver?.id).toBe(BOB.id);

    // And authority still follows the snapshot: Bob decides, not Alice.
    const bob = await chainService.canDecide(OWNER, BOB.id, {
      hasSuperGrant: false,
      isSystemAdmin: false,
    });
    expect(bob.allowed).toBe(true);
    const alice = await chainService.canDecide(OWNER, ALICE.id, {
      hasSuperGrant: false,
      isSystemAdmin: false,
    });
    expect(alice.allowed).toBe(false);
  });
});

// ── Progress ──
describe("progress", () => {
  it("treats a record with no snapshot as NOT complete", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([]);
    const progress = await chainService.progress(OWNER);
    // The alternative would auto-approve every record predating chains.
    expect(progress.isComplete).toBe(false);
    expect(progress.totalStages).toBe(0);
    expect(progress.currentOrder).toBeNull();
  });

  it("is complete only when every stage approved", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.APPROVED),
      decision(2, DECISION_STATUS.APPROVED),
    ]);
    const progress = await chainService.progress(OWNER);
    expect(progress.isComplete).toBe(true);
    expect(progress.currentOrder).toBeNull();
  });

  it("is neither complete nor pending once rejected", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.REJECTED),
      decision(2, DECISION_STATUS.SKIPPED),
    ]);
    const progress = await chainService.progress(OWNER);
    expect(progress.isRejected).toBe(true);
    expect(progress.isComplete).toBe(false);
  });
});

// ── Authority ──
describe("who may decide", () => {
  beforeEach(() => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
      decision(2, DECISION_STATUS.PENDING, BOB),
    ]);
  });

  it("allows the named approver of the current stage", async () => {
    const res = await chainService.canDecide(OWNER, ALICE.id, {
      hasSuperGrant: false,
      isSystemAdmin: false,
    });
    expect(res).toMatchObject({ allowed: true, order: 1 });
  });

  it("refuses the approver of a LATER stage, and says who it waits on", async () => {
    const res = await chainService.canDecide(OWNER, BOB.id, {
      hasSuperGrant: false,
      isSystemAdmin: false,
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/waiting on Alice/);
  });

  it("allows a super-grant holder, so a stalled chain can be unstuck", async () => {
    const res = await chainService.canDecide(OWNER, "u-other", {
      hasSuperGrant: true,
      isSystemAdmin: false,
    });
    expect(res.allowed).toBe(true);
  });

  it("lets a system admin act only when the stage names nobody", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
    ]);
    const named = await chainService.canDecide(OWNER, "u-admin", {
      hasSuperGrant: false,
      isSystemAdmin: true,
    });
    // A stage with a real approver belongs to that approver.
    expect(named.allowed).toBe(false);

    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, null),
    ]);
    const orphaned = await chainService.canDecide(OWNER, "u-admin", {
      hasSuperGrant: false,
      isSystemAdmin: true,
    });
    expect(orphaned.allowed).toBe(true);
  });

  it("refuses when the record follows no chain at all", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([]);
    const res = await chainService.canDecide(OWNER, ALICE.id, {
      hasSuperGrant: true,
      isSystemAdmin: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/not following a configured approval chain/i);
  });
});

// ── Notification targets ──
describe("who to notify", () => {
  it("names the approver of the pending stage", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.APPROVED),
      decision(2, DECISION_STATUS.PENDING, BOB),
    ]);
    const to = await chainService.currentApprovers(OWNER);
    expect(to.map((u) => u.id)).toEqual([BOB.id]);
  });

  it("falls back to system admins when the stage resolves to nobody", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, null),
    ]);
    db.user.findMany.mockResolvedValue([
      { id: "u-admin", name: "Admin", email: "admin@x.com" },
    ]);
    const to = await chainService.currentApprovers(OWNER);
    // Stalling visibly, with somebody told, beats routing into silence.
    expect(to.map((u) => u.id)).toEqual(["u-admin"]);
  });

  it("names nobody once the chain is finished", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.APPROVED),
    ]);
    await expect(chainService.currentApprovers(OWNER)).resolves.toEqual([]);
  });
});

// ── Advancing ──
describe("advancing", () => {
  it("reports the next stage after an approval", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
      decision(2, DECISION_STATUS.PENDING, BOB),
    ]);
    const res = await chainService.advance(db as never, OWNER, {
      decisionId: "d1",
      approve: true,
      actorId: ALICE.id,
    });
    expect(res).toEqual({ settledOrder: 1, nextOrder: 2, isComplete: false });
  });

  it("reports completion when the last stage approves", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.APPROVED),
      decision(2, DECISION_STATUS.PENDING, BOB),
    ]);
    const res = await chainService.advance(db as never, OWNER, {
      decisionId: "d2",
      approve: true,
      actorId: BOB.id,
    });
    expect(res).toEqual({ settledOrder: 2, nextOrder: null, isComplete: true });
  });

  it("skips the remaining stages on a rejection", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
      decision(2, DECISION_STATUS.PENDING, BOB),
    ]);
    const res = await chainService.advance(db as never, OWNER, {
      decisionId: "d1",
      approve: false,
      actorId: ALICE.id,
      notes: "no budget",
    });
    expect(res.isComplete).toBe(false);
    expect(res.nextOrder).toBeNull();

    // Leaving later stages pending would keep the record in somebody's queue.
    const skip = db.approvalChainDecision.updateMany.mock.calls.find(
      (c: [{ data: { status?: string } }]) => c[0].data.status === "skipped",
    );
    expect(skip).toBeDefined();
  });

  it("settles a stage only while it is still pending", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
    ]);
    await chainService.advance(db as never, OWNER, {
      decisionId: "d1",
      approve: true,
      actorId: ALICE.id,
    });
    const where = db.approvalChainDecision.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: "d1", status: "pending" });
  });

  it("refuses the loser of a race rather than overwriting the winner", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
    ]);
    // Somebody settled it between the read and the write.
    db.approvalChainDecision.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      chainService.advance(db as never, OWNER, {
        decisionId: "d1",
        approve: true,
        actorId: ALICE.id,
      }),
    ).rejects.toThrow(/already decided/i);
  });

  it("rejects an unknown stage id", async () => {
    db.approvalChainDecision.findMany.mockResolvedValue([
      decision(1, DECISION_STATUS.PENDING, ALICE),
    ]);
    await expect(
      chainService.advance(db as never, OWNER, {
        decisionId: "nope",
        approve: true,
        actorId: ALICE.id,
      }),
    ).rejects.toThrow(/not found/i);
  });
});

// ── Resubmission ──
describe("clearing a snapshot", () => {
  it("discards the decisions so a resubmission follows today's chain", async () => {
    await chainService.clear(db as never, OWNER);
    expect(db.approvalChainDecision.deleteMany).toHaveBeenCalledWith({
      where: { projectId: undefined, proposalId: "p1" },
    });
  });
});
