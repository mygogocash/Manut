import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { isSystemAdmin } from "@/core/guards/auth.guard";
import { prisma } from "@/infrastructure/database/prisma";
import { chainService } from "@/modules/approval-chains/chain.service";
import { workflowService } from "@/modules/projects/workflow/workflow.service";
import {
  allowedActions,
  TRANSITIONS,
  WORKFLOW_STATUS,
} from "@/modules/projects/workflow/workflow.types";

vi.mock("@/infrastructure/database/prisma", () => {
  const client: Record<string, unknown> = {
    // The transition uses the CALLBACK form, because the chain's answer decides
    // where an approval lands. Other call sites still pass an array, so the mock
    // dispatches on what it received.
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => Promise<unknown>)(client)
        : Promise.resolve(arg),
    ),
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    projectWorkflowTransition: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    userRole: { findMany: vi.fn() },
  };
  return { prisma: client };
});

// The chain engine, mocked at its service. `progress` reporting zero stages is
// the DEFAULT on purpose: that is a project which predates configurable chains,
// and every existing test below then exercises the original single-PM path,
// which is exactly the behaviour that must not change.
vi.mock("@/modules/approval-chains/chain.service", () => ({
  chainService: {
    progress: vi.fn(),
    canDecide: vi.fn(),
    advance: vi.fn(),
    snapshot: vi.fn(),
    clear: vi.fn(),
    currentApprovers: vi.fn(),
  },
}));

vi.mock("@/core/guards/auth.guard", () => ({ isSystemAdmin: vi.fn() }));
// Email fan-out is covered by workflow-email.service.test.ts; stub it here so
// these tests exercise the state machine in isolation.
vi.mock("@/modules/projects/workflow/workflow-email.service", () => ({
  workflowEmailService: { onTransition: vi.fn().mockResolvedValue(undefined) },
}));

const chain = chainService as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const admin = { isSystemAdmin } as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const db = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  project: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  projectWorkflowTransition: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  userRole: { findMany: ReturnType<typeof vi.fn> };
};

const ACTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TARGET = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ALL_PERMS = [
  "workflow:submit",
  "workflow:pm-approve",
  "workflow:business-head-approve",
  "workflow:product-admin-approve",
  "workflow:complete",
  "workflow:return",
  "workflow:reopen",
  "workflow:archive",
  "workflow:escalate",
  "workflow:reassign",
  "workflow:timeline-manage",
  "workflow:progress-update",
];

function projectAt(status: string | null) {
  return {
    id: "p1",
    name: "Demo",
    // The workflow only drives its own team's boards; every fixture here is a
    // Project CRM request.
    team: "general",
    ownerId: ACTOR,
    members: [],
    workflowStatus: status,
    archivedAt: null,
    escalatedToId: null,
  };
}

beforeEach(() => {
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
  chain.clear.mockResolvedValue({ count: 0 });
  admin.isSystemAdmin.mockResolvedValue(false);
  db.project.findUnique.mockReset();
  db.project.update.mockImplementation((a: { data: object }) => ({
    id: "p1",
    ...a.data,
  }));
  db.projectWorkflowTransition.create.mockImplementation(
    (a: { data: object }) => ({ id: "t1", createdAt: new Date(), ...a.data }),
  );
  db.projectWorkflowTransition.findMany.mockResolvedValue([]);
  db.auditLog.create.mockReturnValue({ id: "a1" });
  db.user.findMany.mockResolvedValue([]);
  db.user.findUnique.mockResolvedValue({ name: "Test Actor" });
  db.userRole.findMany.mockResolvedValue([
    { role: { name: "Project Manager" } },
  ]);
});

// ── State machine shape ──
describe("workflow state machine", () => {
  it("routes a PM approval straight to approved — no further sign-off", () => {
    expect(TRANSITIONS[WORKFLOW_STATUS.DRAFT]?.submit).toBe(
      WORKFLOW_STATUS.PENDING_PM_APPROVAL,
    );
    // The whole point of the PM gate: most requests need exactly one approval.
    expect(TRANSITIONS[WORKFLOW_STATUS.PENDING_PM_APPROVAL]?.approve).toBe(
      WORKFLOW_STATUS.APPROVED,
    );
    expect(TRANSITIONS[WORKFLOW_STATUS.APPROVED]?.complete).toBe(
      WORKFLOW_STATUS.COMPLETED,
    );
  });

  it("lets the PM escalate, and the target's approval approves the request", () => {
    expect(TRANSITIONS[WORKFLOW_STATUS.PENDING_PM_APPROVAL]?.escalate).toBe(
      WORKFLOW_STATUS.PENDING_ESCALATION,
    );
    expect(TRANSITIONS[WORKFLOW_STATUS.PENDING_ESCALATION]?.approve).toBe(
      WORKFLOW_STATUS.APPROVED,
    );
    // The target can hand it back to the PM instead of deciding.
    expect(TRANSITIONS[WORKFLOW_STATUS.PENDING_ESCALATION]?.return).toBe(
      WORKFLOW_STATUS.PENDING_PM_APPROVAL,
    );
  });

  it("has no fixed Business Head or Product Admin stage", () => {
    const statuses = Object.values(WORKFLOW_STATUS) as string[];
    expect(statuses).not.toContain("pending_business_head_approval");
    expect(statuses).not.toContain("pending_product_admin_approval");
  });

  it("allows rejection from every pending stage", () => {
    for (const s of [
      WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      WORKFLOW_STATUS.PENDING_ESCALATION,
      WORKFLOW_STATUS.APPROVED,
    ]) {
      expect(TRANSITIONS[s]?.reject).toBe(WORKFLOW_STATUS.REJECTED);
    }
  });

  it("treats completed as terminal, and rejected as reopenable by the PM", () => {
    expect(allowedActions(WORKFLOW_STATUS.COMPLETED)).toEqual([]);
    expect(allowedActions(WORKFLOW_STATUS.REJECTED)).toEqual(["reopen"]);
  });

  it("does not allow a draft to be approved directly (no stage skipping)", () => {
    expect(TRANSITIONS[WORKFLOW_STATUS.DRAFT]?.approve).toBeUndefined();
  });
});

// ── Happy path ──
describe("workflow transitions", () => {
  it("submits a draft to Pending PM Approval", async () => {
    db.project.findUnique.mockResolvedValue(projectAt(WORKFLOW_STATUS.DRAFT));
    const r = await workflowService.submit("p1", ACTOR, ALL_PERMS);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.PENDING_PM_APPROVAL);
  });

  it("treats a project that never entered the workflow as draft (back-compat)", async () => {
    db.project.findUnique.mockResolvedValue(projectAt(null));
    const r = await workflowService.submit("p1", ACTOR, ALL_PERMS);
    expect(r.transition.fromStatus).toBe(WORKFLOW_STATUS.DRAFT);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.PENDING_PM_APPROVAL);
  });

  it("takes the short path when the PM approves outright", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    const approved = await workflowService.approve("p1", ACTOR, ALL_PERMS);
    // One approval and the work is released — no Business Head, no Product Admin.
    expect(approved.transition.toStatus).toBe(WORKFLOW_STATUS.APPROVED);

    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.APPROVED),
    );
    const done = await workflowService.complete("p1", ACTOR, ALL_PERMS);
    expect(done.transition.toStatus).toBe(WORKFLOW_STATUS.COMPLETED);
  });

  it("takes the escalated path when the PM refers it on", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    db.user.findUnique.mockResolvedValue({
      id: TARGET,
      name: "Head",
      isActive: true,
    });
    const escalated = await workflowService.escalate(
      "p1",
      ACTOR,
      ALL_PERMS,
      TARGET,
    );
    expect(escalated.transition.toStatus).toBe(
      WORKFLOW_STATUS.PENDING_ESCALATION,
    );

    // Only the named target can then release it.
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: TARGET,
    });
    const released = await workflowService.approve("p1", TARGET, ALL_PERMS);
    expect(released.transition.toStatus).toBe(WORKFLOW_STATUS.APPROVED);
  });

  it("refuses an escalation to yourself, or to nobody", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    await expect(
      workflowService.escalate("p1", ACTOR, ALL_PERMS, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.user.findUnique.mockResolvedValue(null);
    await expect(
      workflowService.escalate("p1", ACTOR, ALL_PERMS, TARGET),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an escalated approval from anyone but the named target", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: TARGET,
    });
    // ACTOR holds every workflow permission and is still refused: the gate is
    // identity, not permissions.
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── Illegal transitions ──
describe("workflow guards", () => {
  it("rejects an unknown project", async () => {
    db.project.findUnique.mockResolvedValue(null);
    await expect(
      workflowService.approve("nope", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks stage skipping (approve straight from draft)", async () => {
    db.project.findUnique.mockResolvedValue(projectAt(WORKFLOW_STATUS.DRAFT));
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks completing before development", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    await expect(
      workflowService.complete("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks any action on a terminal state", async () => {
    for (const s of [WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.REJECTED]) {
      db.project.findUnique.mockResolvedValue(projectAt(s));
      await expect(
        workflowService.approve("p1", ACTOR, ALL_PERMS),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        workflowService.reject("p1", ACTOR, ALL_PERMS, "no"),
      ).rejects.toBeInstanceOf(BadRequestException);
      // (rejected -> reopen is the one legal move, and only for the PM)
    }
  });
});

// ── Authorization (stage-specific) ──
describe("workflow authorization", () => {
  it("refuses a caller without the stage permission", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
    );
    await expect(
      workflowService.approve("p1", ACTOR, ["workflow:pm-approve"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("accepts the matching stage permission only", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    const r = await workflowService.approve("p1", ACTOR, [
      "workflow:pm-approve",
    ]);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.APPROVED);

    // A code for a different stage is not enough.
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    await expect(
      workflowService.approve("p1", ACTOR, ["workflow:complete"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets projects:manage act at the PM stage (admin bypass)", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    const r = await workflowService.approve("p1", ACTOR, ["projects:manage"]);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.APPROVED);
  });

  // The super-grant covers permission gates, not identity: an escalation names
  // a person, and recording their approval against an admin would be a lie.
  it("does NOT let projects:manage decide someone else's escalation", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: TARGET,
    });
    await expect(
      workflowService.approve("p1", ACTOR, ["projects:manage"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── Rejection ──
describe("workflow rejection", () => {
  it("requires a reason", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    await expect(
      workflowService.reject("p1", ACTOR, ALL_PERMS, "   "),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects with a reason and records it", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    const r = await workflowService.reject(
      "p1",
      ACTOR,
      ALL_PERMS,
      "Out of scope this quarter",
    );
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.REJECTED);
    expect(r.transition.comment).toBe("Out of scope this quarter");
  });
});

// ── Atomicity + logging ──
describe("workflow atomicity and logging", () => {
  it("applies status, history and audit in a single transaction", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    await workflowService.approve("p1", ACTOR, ALL_PERMS, "looks good");

    // One transaction, with all three writes inside it. Asserted by what was
    // written rather than by counting prepared operations: the transition now
    // uses a callback, because the chain's answer decides where it lands.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.project.update).toHaveBeenCalledTimes(1);
    expect(db.projectWorkflowTransition.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.project.update).toHaveBeenCalled();
    expect(db.projectWorkflowTransition.create).toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it("writes no history when the transition is illegal", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.COMPLETED),
    );
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.projectWorkflowTransition.create).not.toHaveBeenCalled();
  });

  it("logs the audit action with previous and new status", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.APPROVED),
    );
    await workflowService.complete("p1", ACTOR, ALL_PERMS);
    const audit = db.auditLog.create.mock.calls.at(-1)![0] as {
      data: { action: string; details: Record<string, unknown> };
    };
    expect(audit.data.action).toBe("project.workflow.complete");
    expect(audit.data.details.previousStatus).toBe(WORKFLOW_STATUS.APPROVED);
    expect(audit.data.details.newStatus).toBe(WORKFLOW_STATUS.COMPLETED);
  });
});

// ── Read model ──
describe("workflow getState", () => {
  it("reports available actions filtered by permission", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    // `workflow:pm-approve` alone grants the two decisions, but NOT `return`
    // (that needs `workflow:return`) — per-action authority, not per-stage.
    const withPerm = await workflowService.getState("p1", [
      "workflow:pm-approve",
    ]);
    expect(withPerm.availableActions.sort()).toEqual(["approve", "reject"]);

    const owner = await workflowService.getState("p1", ALL_PERMS);
    expect(owner.availableActions.sort()).toEqual([
      "approve",
      "escalate",
      "reject",
      "return",
    ]);

    const withoutPerm = await workflowService.getState("p1", []);
    expect(withoutPerm.allowedActions.sort()).toEqual([
      "approve",
      "escalate",
      "reject",
      "return",
    ]);
    expect(withoutPerm.availableActions).toEqual([]);
  });
});

// ── listQueue: tab counts derived from one groupBy ──
describe("listQueue tab counts", () => {
  const tally = [
    {
      workflowStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      _count: { _all: 4 },
    },
    {
      workflowStatus: WORKFLOW_STATUS.PENDING_ESCALATION,
      _count: { _all: 3 },
    },
    { workflowStatus: WORKFLOW_STATUS.COMPLETED, _count: { _all: 5 } },
    { workflowStatus: WORKFLOW_STATUS.REJECTED, _count: { _all: 2 } },
  ];

  beforeEach(() => {
    db.project.findMany.mockResolvedValue([]);
    db.project.groupBy.mockResolvedValue(tally);
    db.project.count.mockResolvedValue(7);
  });

  it("derives list/completed/rejected from the single tally", async () => {
    const res = await workflowService.listQueue("u1", ALL_PERMS, "list");
    expect(res.counts.list).toBe(14); // 4 + 3 + 5 + 2
    expect(res.counts.completed).toBe(5);
    expect(res.counts.rejected).toBe(2);
    expect(res.counts.mine).toBe(7); // the one separate count()
  });

  it("counts the stages the caller may act on, plus escalations aimed at them", async () => {
    // db.project.count backs both `mine` and `escalatedToMe`, so it returns 7
    // for each here — the assertions below account for that.
    const pm = await workflowService.listQueue(
      "u1",
      ["workflow:pm-approve"],
      "list",
    );
    // 4 at the PM stage + the 7 escalated to this caller.
    expect(pm.counts.pending).toBe(11);

    // No stage permissions at all still surfaces your own escalations — that is
    // the whole point: being named is the authority, not a permission code.
    const none = await workflowService.listQueue("u1", [], "list");
    expect(none.counts.pending).toBe(7);
  });

  it("issues one groupBy instead of a count per tab", async () => {
    await workflowService.listQueue("u1", ALL_PERMS, "list");
    // Four of the five tab counts come from the single tally. The two remaining
    // count() calls are the ones the tally cannot answer: `mine` filters on
    // owner, and escalations filter on the named target.
    expect(db.project.groupBy).toHaveBeenCalledTimes(1);
    expect(db.project.count).toHaveBeenCalledTimes(2);
  });

  it("resolves row actions per status, and gates them on authority", async () => {
    db.project.findMany.mockResolvedValue([
      {
        id: "a",
        name: "A",
        department: null,
        workflowStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
        workflowUpdatedAt: new Date("2026-01-01"),
        goLiveDate: null,
        createdAt: new Date("2026-01-01"),
        owner: { id: "o", name: "Owner" },
      },
      {
        id: "b",
        name: "B",
        department: null,
        workflowStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
        workflowUpdatedAt: null,
        goLiveDate: null,
        createdAt: new Date("2026-01-02"),
        owner: null,
      },
    ]);

    const allowed = await workflowService.listQueue("u1", ALL_PERMS, "list");
    // Same status -> same resolved actions on every row.
    expect(allowed.rows[0].availableActions).toEqual(
      allowed.rows[1].availableActions,
    );
    expect(allowed.rows[0].availableActions).toContain("approve");
    expect(allowed.rows[1].owner).toBe("—"); // null owner renders as a dash

    const denied = await workflowService.listQueue("u1", [], "list");
    expect(denied.rows[0].availableActions).toEqual([]);
  });
});

// ── Configurable approval chain ──
//
// The chain owns the APPROVAL SEGMENT only. Escalate, return, reopen and
// complete stay coded transitions, because none of them is "the next step in an
// order" — escalation in particular routes to somebody named per request.
describe("workflow with a configured chain", () => {
  /** Put the request on a chain of `stages`, waiting at `at`. */
  function onChain(stages: number, at: number, decidable = true) {
    chain.progress.mockResolvedValue({
      currentOrder: at,
      isComplete: false,
      isRejected: false,
      totalStages: stages,
      decisions: [],
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

  it("stays in approval while a later stage still owes a decision", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    onChain(3, 1);
    const r = await workflowService.approve("p1", ACTOR, ALL_PERMS);
    // NOT released to development: two more stages to go.
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.PENDING_PM_APPROVAL);
  });

  it("approves the request when the last stage approves", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    onChain(3, 3);
    const r = await workflowService.approve("p1", ACTOR, ALL_PERMS);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.APPROVED);
  });

  // Escalation is a detour ON a stage, not a way past the rest of the chain.
  it("resumes the chain after an escalated approval rather than skipping it", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: ACTOR,
    });
    onChain(3, 2);
    const r = await workflowService.approve("p1", ACTOR, ALL_PERMS);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.PENDING_PM_APPROVAL);
  });

  it("approves an escalated request when it was the last stage", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: ACTOR,
    });
    onChain(2, 2);
    const r = await workflowService.approve("p1", ACTOR, ALL_PERMS);
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.APPROVED);
  });

  // Holding the permission is no longer enough once a chain names people.
  it("refuses somebody the current stage does not name", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    onChain(2, 1, false);
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("ends the chain on a rejection", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    onChain(3, 1);
    const r = await workflowService.reject("p1", ACTOR, ALL_PERMS, "no budget");
    expect(r.transition.toStatus).toBe(WORKFLOW_STATUS.REJECTED);
    expect(chain.advance).toHaveBeenCalledWith(
      expect.anything(),
      { projectId: "p1" },
      expect.objectContaining({ approve: false }),
    );
  });

  // A resubmission should follow TODAY'S chain, not the one captured before the
  // request was sent back.
  it("discards the snapshot when a request returns to draft", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
    );
    onChain(2, 1);
    await workflowService.returnToRequester(
      "p1",
      ACTOR,
      ALL_PERMS,
      "needs detail",
    );
    expect(chain.clear).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
    });
  });

  it("takes a fresh snapshot when a draft is submitted", async () => {
    db.project.findUnique.mockResolvedValue(projectAt(WORKFLOW_STATUS.DRAFT));
    await workflowService.submit("p1", ACTOR, ALL_PERMS);
    expect(chain.snapshot).toHaveBeenCalledWith(
      expect.anything(),
      "project_request",
      { projectId: "p1" },
    );
  });
});

// These routes were reachable by anyone holding `projects:read` — which the
// Employee role has — and returned a project's details, task comments and
// resource URLs, including rows belonging to other CRMs.
describe("request visibility", () => {
  const OUTSIDER = ["projects:read"];

  function row(over: Record<string, unknown> = {}) {
    return {
      id: "p1",
      team: "general",
      ownerId: "somebody-else",
      escalatedToId: null,
      workflowStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      archivedAt: null,
      members: [],
      ...over,
    };
  }

  it("refuses a reader who is not on the project and holds no stage capability", async () => {
    db.project.findUnique.mockResolvedValue(row());
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, OUTSIDER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows the requester", async () => {
    db.project.findUnique.mockResolvedValue(row({ ownerId: ACTOR }));
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, OUTSIDER),
    ).resolves.toBeUndefined();
  });

  it("allows somebody on the board", async () => {
    db.project.findUnique.mockResolvedValue(row({ members: [{ id: "m1" }] }));
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, OUTSIDER),
    ).resolves.toBeUndefined();
  });

  it("allows the escalation target", async () => {
    db.project.findUnique.mockResolvedValue(row({ escalatedToId: ACTOR }));
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, OUTSIDER),
    ).resolves.toBeUndefined();
  });

  // An approver is legitimately not a member of the project they gate.
  it("allows a non-member who can act on the current stage", async () => {
    db.project.findUnique.mockResolvedValue(row());
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, ALL_PERMS),
    ).resolves.toBeUndefined();
  });

  it("allows a projects:read-all holder", async () => {
    db.project.findUnique.mockResolvedValue(row());
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, [
        ...OUTSIDER,
        "projects:read-all",
      ]),
    ).resolves.toBeUndefined();
  });

  it("404s a project that does not exist", async () => {
    db.project.findUnique.mockResolvedValue(null);
    await expect(
      workflowService.assertCanViewRequest("nope", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // `statusOf(null)` is draft, and draft's only action (`submit`) is granted
  // unconditionally — so without excluding it, every HR / Legal / Accounting
  // row (all of which have a null workflow status) was readable by any
  // `workflow:submit` holder.
  it("refuses a draft/never-submitted row to a workflow:submit holder", async () => {
    db.project.findUnique.mockResolvedValue(
      row({ workflowStatus: null, team: "hr" }),
    );
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, [
        "projects:read",
        "workflow:submit",
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses another CRM's row even at a workflow status", async () => {
    db.project.findUnique.mockResolvedValue(row({ team: "hr" }));
    await expect(
      workflowService.assertCanViewRequest("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// These routes accepted ANY project id: a workflow:submit holder could freeze
// an HR board by stamping it pending_pm_approval, and a workflow:archive
// holder could archive another CRM's row out of its own board.
describe("workflow routes refuse other CRMs", () => {
  it("refuses to submit a project that is not on a workflow team", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(null),
      team: "hr",
    });
    await expect(
      workflowService.submit("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses to archive a project that is not on a workflow team", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.COMPLETED),
      team: "legal",
    });
    await expect(
      workflowService.setArchived("p1", ACTOR, ALL_PERMS, true),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("still archives its own team's project", async () => {
    db.project.findUnique.mockResolvedValue(
      projectAt(WORKFLOW_STATUS.COMPLETED),
    );
    await expect(
      workflowService.setArchived("p1", ACTOR, ALL_PERMS, true),
    ).resolves.toBeDefined();
  });

  // The fixture above makes ACTOR the owner, which short-circuits
  // assertCanViewRequest at its first branch — so without this case the guard
  // could be deleted from transition() and the suite would stay green.
  it("refuses a stranger who is neither participant nor approver", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(null),
      ownerId: "somebody-else",
      members: [],
    });
    await expect(
      workflowService.submit("p1", ACTOR, ["projects:read", "workflow:submit"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// Every action legal from `pending_escalation` is gated on being the named
// target, and the read model never supplied that fact — so the target saw an
// empty action bar, nothing else could move the request, and the board froze
// permanently.
describe("escalation is actionable by its target", () => {
  it("offers the target their actions", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: ACTOR,
    });
    const state = await workflowService.getState("p1", ALL_PERMS, ACTOR);
    expect(state.availableActions.length).toBeGreaterThan(0);
  });

  it("offers nothing to somebody who is not the target", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: TARGET,
      ownerId: ACTOR,
    });
    const state = await workflowService.getState("p1", ALL_PERMS, ACTOR);
    expect(state.availableActions).toEqual([]);
  });
});

// The queue is the amplifier for the above: it hands out ids to feed the
// detail route, so it has to be scoped the same way.
describe("queue scoping", () => {
  beforeEach(() => {
    db.project.findMany.mockResolvedValue([]);
    db.project.groupBy.mockResolvedValue([]);
    db.project.count.mockResolvedValue(0);
  });

  it("restricts the all-requests view to rows the actor may see", async () => {
    await workflowService.listQueue(ACTOR, ["projects:read"], "list");
    const where = db.project.findMany.mock.calls[0][0].where as {
      AND?: unknown[];
    };
    expect(where.AND).toBeDefined();
    expect(JSON.stringify(where)).toContain(ACTOR);
  });

  it("leaves a projects:read-all holder unscoped", async () => {
    await workflowService.listQueue(
      ACTOR,
      ["projects:read", "projects:read-all"],
      "list",
    );
    const where = db.project.findMany.mock.calls[0][0].where as {
      AND?: unknown[];
    };
    expect(where.AND).toBeUndefined();
  });
});

// Seeding a chain (migration 20261214) made `canDecide` apply to every
// submitted request. An escalation target is by definition NOT the chain's
// named approver, so without a bypass the person the escalation appointed —
// and whom the notification email points at — would be refused.
describe("escalation versus the chain", () => {
  /** A live 2-stage chain sitting at stage 1 that refuses this actor. */
  function chainRefuses() {
    chain.progress.mockResolvedValue({
      currentOrder: 1,
      isComplete: false,
      isRejected: false,
      totalStages: 2,
      decisions: [],
    });
    chain.canDecide.mockResolvedValue({ allowed: false, reason: "not yours" });
    chain.advance.mockResolvedValue({
      settledOrder: 1,
      nextOrder: 2,
      isComplete: false,
    });
  }

  it("lets the escalation target approve even when the chain names somebody else", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: ACTOR,
    });
    chainRefuses();
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).resolves.toBeDefined();
  });

  // The bypass let them THROUGH, but `canDecide` only returns a decisionId on
  // its allow branch — so the stage was never settled: the decision row stayed
  // pending forever, and with 2+ stages the request skipped straight to
  // approved instead of advancing to the next stage.
  it("settles and advances the chain on an escalated approval", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_ESCALATION),
      escalatedToId: ACTOR,
    });
    chainRefuses();
    chain.progress.mockResolvedValue({
      currentOrder: 1,
      isComplete: false,
      isRejected: false,
      totalStages: 2,
      decisions: [{ id: "d-pending", status: "pending", order: 1 }],
    });
    await workflowService.approve("p1", ACTOR, ALL_PERMS);
    expect(chain.advance).toHaveBeenCalled();
  });

  it("still refuses a non-target the chain does not name", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
      escalatedToId: TARGET,
    });
    chainRefuses();
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // A `return` from pending_escalation lands on pending_pm_approval. If the
  // stale escalated_to_id still counted, the previous target could settle the
  // NEXT stage — one named to somebody else — and the audit row would record
  // that other person's stage as decided by them.
  it("refuses a stale escalation target once the request has moved on", async () => {
    db.project.findUnique.mockResolvedValue({
      ...projectAt(WORKFLOW_STATUS.PENDING_PM_APPROVAL),
      escalatedToId: ACTOR,
    });
    chainRefuses();
    await expect(
      workflowService.approve("p1", ACTOR, ALL_PERMS),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
