import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { isSystemAdmin } from "@/core/guards/auth.guard";
import { prisma } from "@/infrastructure/database/prisma";
import { chainService } from "@/modules/approval-chains/chain.service";
import { proposalService } from "@/modules/proposals/proposal.service";
import {
  allowedActions,
  PROPOSAL_STATUS,
  TRANSITIONS,
} from "@/modules/proposals/proposal.types";

// The chain engine is mocked at its service, so these tests stay about the
// proposal flow. `progress` returning zero stages is the DEFAULT on purpose: it
// exercises the legacy path, which is what a proposal raised before chains does,
// and proves that path still works.
vi.mock("@/modules/approval-chains/chain.service", () => ({
  chainService: {
    progress: vi.fn(),
    canDecide: vi.fn(),
    advance: vi.fn(),
    snapshot: vi.fn(),
    currentApprovers: vi.fn(),
  },
}));

// Reading the system-Admin role would hit the database; the flag is what matters.
vi.mock("@/core/guards/auth.guard", () => ({ isSystemAdmin: vi.fn() }));

vi.mock("@/infrastructure/database/prisma", () => {
  const client: Record<string, unknown> = {
    // Both forms are used. `askForInformation` passes an ARRAY of prepared
    // operations and destructures the results; `transition` passes a CALLBACK,
    // because it has to abort mid-transaction when the status has moved under
    // it. The mock dispatches on which it received and hands the callback the
    // same client, so `tx.x.y()` resolves to the same mocks.
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => Promise<unknown>)(client)
        : Promise.resolve(arg),
    ),
    // The write mocks echo their input, because the array form returns whatever
    // each prepared operation resolves to and the service destructures those.
    proposal: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(() => ({
        id: "p1",
        title: "A proposal",
        status: "pending_ceo_approval",
        statusChangedAt: new Date(),
      })),
      // Conditional on the status still matching. count 0 means somebody else
      // moved it first.
      updateMany: vi.fn(() => ({ count: 1 })),
      update: vi.fn((args) => ({ id: "p1", ...args.data })),
    },
    proposalInformationRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn((args) => ({ id: "q-new", ...args.data })),
      update: vi.fn((args) => ({ id: "q1", ...args.data })),
    },
    proposalTransition: {
      create: vi.fn((args) => ({ id: "t1", ...args.data })),
      findMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    user: { findMany: vi.fn() },
    userRole: { findMany: vi.fn() },
  };
  return { prisma: client };
});

type M = ReturnType<typeof vi.fn>;
const chain = chainService as unknown as {
  progress: M;
  canDecide: M;
  advance: M;
  snapshot: M;
  currentApprovers: M;
};
const admin = { isSystemAdmin } as unknown as { isSystemAdmin: M };
// Shaped explicitly rather than as a nested Record, so `.mock.calls` resolves.
const db = prisma as unknown as {
  $transaction: M;
  proposal: {
    findUnique: M;
    findUniqueOrThrow: M;
    updateMany: M;
    update: M;
  };
  proposalInformationRequest: {
    findUnique: M;
    findMany: M;
    create: M;
    update: M;
  };
  proposalTransition: { create: M; findMany: M };
  auditLog: { create: M };
  user: { findMany: M };
  userRole: { findMany: M };
};

const REVIEWER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPROVER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LEGAL = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const FINANCE = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const REVIEW_PERMS = ["proposals:read", "proposals:create", "proposals:review"];
const APPROVE_PERMS = [
  "proposals:read",
  "proposals:create",
  "proposals:approve",
];

const proposalAt = (status: string, raisedById = "someone-else") => ({
  id: "p1",
  title: "Demo proposal",
  status,
  raisedById,
});

/**
 * Put the proposal on a real chain: `stages` long, waiting at `at`, and decidable
 * by whoever the test is acting as unless `decidable` says otherwise.
 */
function onChain(stages: number, at: number, decidable = true) {
  chain.progress.mockResolvedValue({
    currentOrder: at,
    isComplete: false,
    isRejected: false,
    totalStages: stages,
    decisions: Array.from({ length: stages }, (_, i) => ({
      id: `d${i + 1}`,
      order: i + 1,
      name: `Stage ${i + 1}`,
      status: i + 1 < at ? "approved" : "pending",
      approver: null,
      decidedBy: null,
      decidedAt: null,
      notes: null,
    })),
  });
  chain.canDecide.mockResolvedValue(
    decidable
      ? { allowed: true, decisionId: `d${at}`, order: at }
      : { allowed: false, reason: "not yours" },
  );
  chain.advance.mockResolvedValue({
    settledOrder: at,
    nextOrder: at < stages ? at + 1 : null,
    isComplete: at >= stages,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  chain.progress.mockResolvedValue({
    currentOrder: null,
    isComplete: false,
    isRejected: false,
    totalStages: 0,
    decisions: [],
  });
  chain.canDecide.mockResolvedValue({ allowed: false });
  chain.advance.mockResolvedValue({
    settledOrder: 1,
    nextOrder: null,
    isComplete: true,
  });
  chain.snapshot.mockResolvedValue({ stages: 0, firstOrder: null });
  admin.isSystemAdmin.mockResolvedValue(false);
  db.userRole.findMany.mockResolvedValue([
    { role: { name: "Project Manager" } },
  ]);
  db.proposalInformationRequest.findMany.mockResolvedValue([]);
  db.proposalTransition.findMany.mockResolvedValue([]);
});

// ── The detail payload ──
//
// The page renders its progress rail and its Approve/Pass label from `chain`.
// `getState` had computed it since chains landed, but `getDetail` never passed
// it on, so the page read `.stages` of undefined and white-screened in prod.
// Nothing tested the SHAPE of this payload, only the transitions underneath it,
// which is exactly how that reached users.
describe("proposal detail payload", () => {
  beforeEach(() => {
    db.proposal.findUnique.mockResolvedValue({
      ...proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL, REVIEWER),
      description: "Body",
      type: "idea",
      priority: "normal",
      projectId: null,
      project: null,
      statusChangedAt: new Date("2026-08-01T00:00:00Z"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
      updatedAt: new Date("2026-08-01T00:00:00Z"),
    });
    db.user.findMany.mockResolvedValue([{ id: REVIEWER, name: "Reviewer" }]);
  });

  it("carries the chain the page reads", async () => {
    onChain(2, 2);
    const detail = await proposalService.getDetail(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
    );

    expect(detail.chain).toBeDefined();
    expect(detail.chain.totalStages).toBe(2);
    expect(detail.chain.currentStage).toBe(2);
    expect(detail.chain.stages).toHaveLength(2);
  });

  // A proposal raised before chains has no snapshot. The rail must still get a
  // usable shape rather than nothing to read.
  it("carries an empty chain for a proposal that follows none", async () => {
    const detail = await proposalService.getDetail(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
    );

    expect(detail.chain).toEqual({
      currentStage: null,
      totalStages: 0,
      stages: [],
    });
  });

  it("still refuses a caller who cannot read proposals", async () => {
    await expect(proposalService.getDetail("p1", REVIEWER, [])).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("404s a proposal that does not exist", async () => {
    db.proposal.findUnique.mockResolvedValue(null);
    await expect(
      proposalService.getDetail("nope", REVIEWER, REVIEW_PERMS),
    ).rejects.toThrow(NotFoundException);
  });
});

// ── State machine shape ──
describe("proposal state machine", () => {
  // The number of stages is now an administrator's choice, so the state machine
  // no longer counts them. Moving BETWEEN stages leaves the status alone; only
  // finishing the chain changes it.
  it("stays in flight while the chain advances, and approves when it ends", () => {
    expect(TRANSITIONS[PROPOSAL_STATUS.PENDING_APPROVAL]?.advance).toBe(
      PROPOSAL_STATUS.PENDING_APPROVAL,
    );
    expect(TRANSITIONS[PROPOSAL_STATUS.PENDING_APPROVAL]?.finalise).toBe(
      PROPOSAL_STATUS.APPROVED,
    );
  });

  // A proposal written before chains must remain movable.
  it("treats both legacy statuses as in flight", () => {
    for (const s of [
      PROPOSAL_STATUS.PENDING_PM_REVIEW,
      PROPOSAL_STATUS.PENDING_CEO_APPROVAL,
    ]) {
      expect(TRANSITIONS[s]?.finalise).toBe(PROPOSAL_STATUS.APPROVED);
      expect(TRANSITIONS[s]?.decline).toBe(PROPOSAL_STATUS.DECLINED);
    }
  });

  it("allows a decline from either tier", () => {
    for (const s of [
      PROPOSAL_STATUS.PENDING_PM_REVIEW,
      PROPOSAL_STATUS.PENDING_CEO_APPROVAL,
    ]) {
      expect(TRANSITIONS[s]?.decline).toBe(PROPOSAL_STATUS.DECLINED);
    }
  });

  it("treats both outcomes as terminal", () => {
    expect(allowedActions(PROPOSAL_STATUS.APPROVED)).toEqual([]);
    expect(allowedActions(PROPOSAL_STATUS.DECLINED)).toEqual([]);
  });

  // Asking a question must never move the proposal: the reviewer keeps it, and
  // "waiting on 2 answers" is derived from the questions table instead.
  it("has no status for awaiting information", () => {
    const statuses = Object.values(PROPOSAL_STATUS) as string[];
    expect(statuses).not.toContain("awaiting_information");
  });
});

// ── Transitions ──
describe("proposal transitions", () => {
  // Passing a stage that is not the last leaves the status alone: the proposal is
  // still awaiting approval, just from somebody else. Which stage is the chain's
  // business, not the status's.
  it("stays in flight when the chain has a later stage", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL),
    );
    onChain(2, 1);
    const r = await proposalService.pass("p1", REVIEWER, REVIEW_PERMS);
    expect(r.transition.toStatus).toBe(PROPOSAL_STATUS.PENDING_APPROVAL);
    // And it records where the chain went next.
    const data = db.proposal.updateMany.mock.calls[0][0].data;
    expect(data.currentStepOrder).toBe(2);
  });

  it("approves when the chain's last stage passes", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL),
    );
    onChain(2, 2);
    const r = await proposalService.pass("p1", APPROVER_ID, APPROVE_PERMS);
    expect(r.transition.toStatus).toBe(PROPOSAL_STATUS.APPROVED);
    expect(
      db.proposal.updateMany.mock.calls[0][0].data.currentStepOrder,
    ).toBeNull();
  });

  // Six stages is as ordinary as two now.
  it("walks a chain of any length", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL),
    );
    onChain(6, 4);
    const r = await proposalService.pass("p1", REVIEWER, REVIEW_PERMS);
    expect(r.transition.toStatus).toBe(PROPOSAL_STATUS.PENDING_APPROVAL);
    expect(db.proposal.updateMany.mock.calls[0][0].data.currentStepOrder).toBe(
      5,
    );
  });

  it("approves on the final tier", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_CEO_APPROVAL),
    );
    const r = await proposalService.pass("p1", APPROVER_ID, APPROVE_PERMS);
    expect(r.transition.toStatus).toBe(PROPOSAL_STATUS.APPROVED);
  });

  it("writes status, history and audit in ONE transaction", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    await proposalService.pass("p1", REVIEWER, REVIEW_PERMS);
    // One transaction, and all three writes inside it. A proposal must never be
    // able to move without its matching log rows.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.proposal.updateMany).toHaveBeenCalledTimes(1);
    expect(db.proposalTransition.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });

  // Two reviewers acting at once, or one impatient double-click. Both requests
  // read the same status and both pass every check, so the only thing that can
  // separate them is the database.
  describe("concurrent decisions", () => {
    it("moves the proposal only if it is still where the request read it", async () => {
      db.proposal.findUnique.mockResolvedValue(
        proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
      );
      await proposalService.pass("p1", REVIEWER, REVIEW_PERMS);
      const where = db.proposal.updateMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        id: "p1",
        status: PROPOSAL_STATUS.PENDING_PM_REVIEW,
      });
    });

    it("refuses the loser instead of recording a second decision", async () => {
      db.proposal.findUnique.mockResolvedValue(
        proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
      );
      // Somebody else got there first, so the conditional update matches nothing.
      db.proposal.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        proposalService.pass("p1", REVIEWER, REVIEW_PERMS),
      ).rejects.toThrow(/already acted/i);

      // No history, no audit row, and nothing to email about.
      expect(db.proposalTransition.create).not.toHaveBeenCalled();
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });
  });

  it("records the actor's roles and the capability on the audit entry", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    await proposalService.pass("p1", REVIEWER, REVIEW_PERMS);
    const audit = db.auditLog.create.mock.calls[0][0].data;
    expect(audit.details.roles).toEqual(["Project Manager"]);
    expect(audit.details.capability).toBe("decide");
    // The audit records the OUTCOME, which with no later stage is a finalise.
    expect(audit.action).toBe("proposal.finalise");
  });

  it("refuses a decline with no reason, or too short a one", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    await expect(
      proposalService.decline("p1", REVIEWER, REVIEW_PERMS, ""),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      proposalService.decline("p1", REVIEWER, REVIEW_PERMS, "no"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts a decline that carries a real reason", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    const r = await proposalService.decline(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
      "No budget line for this in the current year",
    );
    expect(r.transition.toStatus).toBe(PROPOSAL_STATUS.DECLINED);
  });

  it("refuses any move on a decided proposal", async () => {
    for (const s of [PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.DECLINED]) {
      db.proposal.findUnique.mockResolvedValue(proposalAt(s));
      await expect(
        proposalService.pass("p1", REVIEWER, REVIEW_PERMS),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("404s for a proposal that does not exist", async () => {
    db.proposal.findUnique.mockResolvedValue(null);
    await expect(
      proposalService.pass("nope", REVIEWER, REVIEW_PERMS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // The two tiers must stay separate, otherwise a single person could approve
  // their own pass-through and the second tier would be decorative.
  // Authority is being named on the stage, so holding the old tier codes is not
  // enough when the chain says the stage belongs to somebody else.
  it("refuses somebody the current stage does not name", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL),
    );
    onChain(2, 2, false);
    await expect(
      proposalService.pass("p1", REVIEWER, REVIEW_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // A proposal raised before chains has no stages to be named on, so the codes
  // that used to gate the fixed tiers still decide it. Without this, every
  // in-flight proposal would have become undecidable the day chains landed.
  it("falls back to the old codes when a proposal has no chain", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    const r = await proposalService.pass("p1", REVIEWER, REVIEW_PERMS);
    expect(r.transition.toStatus).toBe(PROPOSAL_STATUS.APPROVED);
  });

  it("refuses somebody with no codes on a proposal with no chain", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    await expect(
      proposalService.pass("p1", LEGAL, ["proposals:read", "proposals:create"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── Asking several people at once ──
describe("asking for information", () => {
  beforeEach(() => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
  });

  it("creates one question per person, in a single transaction", async () => {
    db.user.findMany.mockResolvedValue([{ id: LEGAL }, { id: FINANCE }]);
    await proposalService.askForInformation(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
      [LEGAL, FINANCE],
      "Confirm the contract position and the cost",
    );
    expect(db.proposalInformationRequest.create).toHaveBeenCalledTimes(2);
    // Either the reviewer asked everyone or nobody: a partial fan-out would
    // leave the proposal half-asked.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction.mock.calls[0][0]).toHaveLength(3); // 2 questions + audit
  });

  it("records the stage each question was raised from", async () => {
    db.user.findMany.mockResolvedValue([{ id: LEGAL }]);
    await proposalService.askForInformation(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
      [LEGAL],
      "Confirm the contract position",
    );
    const data = db.proposalInformationRequest.create.mock.calls[0][0].data;
    expect(data.raisedAtStatus).toBe(PROPOSAL_STATUS.PENDING_PM_REVIEW);
    expect(data.askedById).toBe(REVIEWER);
    expect(data.assignedToId).toBe(LEGAL);
  });

  it("does NOT change the proposal's status", async () => {
    db.user.findMany.mockResolvedValue([{ id: LEGAL }]);
    await proposalService.askForInformation(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
      [LEGAL],
      "Confirm the contract position",
    );
    expect(db.proposal.update).not.toHaveBeenCalled();
  });

  it("de-duplicates a person named twice", async () => {
    db.user.findMany.mockResolvedValue([{ id: LEGAL }]);
    await proposalService.askForInformation(
      "p1",
      REVIEWER,
      REVIEW_PERMS,
      [LEGAL, LEGAL],
      "Confirm the contract position",
    );
    expect(db.proposalInformationRequest.create).toHaveBeenCalledTimes(1);
  });

  it("drops the asker from their own list, and refuses if nobody is left", async () => {
    await expect(
      proposalService.askForInformation(
        "p1",
        REVIEWER,
        REVIEW_PERMS,
        [REVIEWER],
        "Asking myself something",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an inactive or unknown assignee", async () => {
    // Only one of the two ids resolves to an active user.
    db.user.findMany.mockResolvedValue([{ id: LEGAL }]);
    await expect(
      proposalService.askForInformation(
        "p1",
        REVIEWER,
        REVIEW_PERMS,
        [LEGAL, "ghost"],
        "Confirm the contract position",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a question with no substance", async () => {
    db.user.findMany.mockResolvedValue([{ id: LEGAL }]);
    await expect(
      proposalService.askForInformation(
        "p1",
        REVIEWER,
        REVIEW_PERMS,
        [LEGAL],
        "?",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses somebody who does not own the current stage", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL),
    );
    onChain(2, 1, false);
    await expect(
      proposalService.askForInformation(
        "p1",
        REVIEWER,
        REVIEW_PERMS,
        [LEGAL],
        "why?",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  /** A question still awaiting its answer. */
  const openQuestion = {
    id: "q1",
    proposalId: "p1",
    assignedToId: LEGAL,
    respondedAt: null,
    askedById: REVIEWER,
    question: "why?",
    proposal: { status: PROPOSAL_STATUS.PENDING_APPROVAL },
  };

  it("lets the named person answer", async () => {
    db.proposalInformationRequest.findUnique.mockResolvedValue(openQuestion);
    await proposalService.provideInformation(
      "q1",
      LEGAL,
      [],
      "The contract allows it",
    );
    const data = db.proposalInformationRequest.update.mock.calls[0][0].data;
    expect(data.response).toBe("The contract allows it");
    expect(data.respondedAt).toBeInstanceOf(Date);
  });

  it("refuses anyone else, including the reviewer who asked", async () => {
    db.proposalInformationRequest.findUnique.mockResolvedValue(openQuestion);
    await expect(
      proposalService.provideInformation(
        "q1",
        REVIEWER,
        REVIEW_PERMS,
        "answer",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses projects:manage, because this gate is identity", async () => {
    db.proposalInformationRequest.findUnique.mockResolvedValue(openQuestion);
    await expect(
      proposalService.provideInformation(
        "q1",
        REVIEWER,
        ["projects:manage"],
        "answer",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Overwriting would silently lose the first answer. The reviewer can ask again.
  it("refuses a second answer to the same question", async () => {
    db.proposalInformationRequest.findUnique.mockResolvedValue({
      ...openQuestion,
      respondedAt: new Date(),
    });
    await expect(
      proposalService.provideInformation("q1", LEGAL, [], "answering again"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an empty answer", async () => {
    db.proposalInformationRequest.findUnique.mockResolvedValue(openQuestion);
    await expect(
      proposalService.provideInformation("q1", LEGAL, [], "   "),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s for a question that does not exist", async () => {
    db.proposalInformationRequest.findUnique.mockResolvedValue(null);
    await expect(
      proposalService.provideInformation("nope", LEGAL, [], "answer"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── Read model ──
describe("proposal state read model", () => {
  it("counts open questions and leaves answered ones out", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    db.proposalInformationRequest.findMany.mockResolvedValue([
      { id: "q1", assignedToId: LEGAL, respondedAt: null },
      { id: "q2", assignedToId: FINANCE, respondedAt: new Date() },
    ]);
    const s = await proposalService.getState("p1", REVIEWER, REVIEW_PERMS);
    expect(s.openQuestionCount).toBe(1);
    expect(s.questions).toHaveLength(2);
  });

  // The reviewer is never blocked by an outstanding question: they can decide as
  // soon as they have enough, rather than waiting on a slow team.
  it("still offers the decision while a question is open", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    db.proposalInformationRequest.findMany.mockResolvedValue([
      { id: "q1", assignedToId: LEGAL, respondedAt: null },
    ]);
    const s = await proposalService.getState("p1", REVIEWER, REVIEW_PERMS);
    expect(s.availableActions.sort()).toEqual(["decline", "pass"]);
  });

  it("offers nothing to someone with no authority at this stage", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    const s = await proposalService.getState("p1", LEGAL, ["proposals:read"]);
    expect(s.availableActions).toEqual([]);
    expect(s.canAskForInformation).toBe(false);
  });

  it("tells an assignee they can answer", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_PM_REVIEW),
    );
    db.proposalInformationRequest.findMany.mockResolvedValue([
      { id: "q1", assignedToId: LEGAL, respondedAt: null },
    ]);
    const s = await proposalService.getState("p1", LEGAL, ["proposals:read"]);
    expect(s.canAnswer).toBe(true);
  });

  it("tells the requester they can edit only before any stage has decided", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL, LEGAL),
    );
    onChain(2, 1, false);
    const first = await proposalService.getState("p1", LEGAL, [
      "proposals:read",
      "proposals:create",
    ]);
    expect(first.canEdit).toBe(true);

    // Stage 1 has approved, so the version that was reviewed stays fixed.
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.PENDING_APPROVAL, LEGAL),
    );
    onChain(2, 2, false);
    const later = await proposalService.getState("p1", LEGAL, [
      "proposals:read",
      "proposals:create",
    ]);
    expect(later.canEdit).toBe(false);
  });

  it("reports terminal state with no actions", async () => {
    db.proposal.findUnique.mockResolvedValue(
      proposalAt(PROPOSAL_STATUS.APPROVED),
    );
    const s = await proposalService.getState("p1", REVIEWER, REVIEW_PERMS);
    expect(s.isTerminal).toBe(true);
    expect(s.availableActions).toEqual([]);
    expect(s.canAskForInformation).toBe(false);
  });
});
