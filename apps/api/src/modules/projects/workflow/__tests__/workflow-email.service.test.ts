import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { deliverEmail } from "@/infrastructure/email/email.service";
import { chainService } from "@/modules/approval-chains/chain.service";
import { WORKFLOW_STATUS } from "@/modules/projects/workflow/workflow.types";
import { workflowEmailService } from "@/modules/projects/workflow/workflow-email.service";
import {
  actionLinksEnabled,
  issueActionToken,
  verifyActionToken,
} from "@/modules/projects/workflow/workflow-token";

process.env.WORKFLOW_EMAIL_TOKEN_SECRET =
  "test-secret-value-long-enough-for-hmac";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    project: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    projectWorkflowEmail: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/infrastructure/email/email.service", () => ({
  deliverEmail: vi.fn(),
}));
// Recipients are resolved from the approval chain first (it is what decides who
// may settle a stage). Default to "no chain" so the permission-based fallback
// these tests were written against still runs.
vi.mock("@/modules/approval-chains/chain.service", () => ({
  chainService: { currentApprovers: vi.fn().mockResolvedValue([]) },
}));

const db = prisma as unknown as {
  project: { findUnique: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  projectWorkflowEmail: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};
const mail = deliverEmail as unknown as ReturnType<typeof vi.fn>;

const PROJECT = {
  id: "p1",
  name: "Payment gateway",
  priority: "high",
  ownerId: "owner1",
  owner: { name: "Dana Requester", email: "dana@tbh.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.project.findUnique.mockResolvedValue(PROJECT);
  db.user.findMany.mockResolvedValue([
    { id: "pm1", name: "Pat PM", email: "pat@tbh.com" },
  ]);
  db.projectWorkflowEmail.create.mockImplementation((a: { data: object }) => ({
    id: "log1",
    ...a.data,
  }));
  db.projectWorkflowEmail.update.mockResolvedValue({});
  mail.mockResolvedValue({ ok: true });
});
afterEach(() => vi.restoreAllMocks());

// ── Signed action tokens ──
describe("workflow action tokens", () => {
  it("is enabled when a secret is configured", () => {
    expect(actionLinksEnabled()).toBe(true);
  });

  it("round-trips a valid token", () => {
    const t = issueActionToken({
      projectId: "p1",
      userId: "u1",
      action: "approve",
      stage: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
    })!;
    const v = verifyActionToken(t);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.p).toBe("p1");
      expect(v.payload.u).toBe("u1");
      expect(v.payload.s).toBe(WORKFLOW_STATUS.PENDING_PM_APPROVAL);
    }
  });

  it("rejects a tampered payload", () => {
    const t = issueActionToken({
      projectId: "p1",
      userId: "u1",
      action: "approve",
      stage: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
    })!;
    const [, sig] = t.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({
        p: "p1",
        u: "attacker",
        a: "approve",
        s: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
        e: Math.floor(Date.now() / 1000) + 999,
      }),
    )
      .toString("base64")
      .replace(/=+$/, "")}.${sig}`;
    expect(verifyActionToken(forged).ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const t = issueActionToken({
      projectId: "p1",
      userId: "u1",
      action: "approve",
      stage: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      ttlDays: -1,
    })!;
    const v = verifyActionToken(t);
    expect(v.ok).toBe(false);
    if (v.ok !== true) expect(v.reason).toBe("expired");
  });

  it("rejects malformed input", () => {
    expect(verifyActionToken("garbage").ok).toBe(false);
  });
});

// ── Duplicate prevention ──
describe("duplicate prevention", () => {
  it("claims a unique key before sending", async () => {
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t1",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: null,
    });
    const claim = db.projectWorkflowEmail.create.mock.calls[0][0] as {
      data: { idempotencyKey: string };
    };
    expect(claim.data.idempotencyKey).toBe(
      "p1:t1:approval_request:pat@tbh.com",
    );
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it("does NOT send when the key is already claimed", async () => {
    db.projectWorkflowEmail.create.mockRejectedValue(
      new Error("Unique constraint failed"),
    );
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t1",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: null,
    });
    expect(mail).not.toHaveBeenCalled();
  });
});

// ── Retry ──
describe("retry behaviour", () => {
  it("retries a transient failure then succeeds", async () => {
    mail
      .mockResolvedValueOnce({ ok: false, error: "boom", retryable: true })
      .mockResolvedValueOnce({ ok: true });

    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t2",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: null,
    });

    expect(mail).toHaveBeenCalledTimes(2);
    const update = db.projectWorkflowEmail.update.mock.calls.at(-1)![0] as {
      data: { status: string; attempts: number };
    };
    expect(update.data.status).toBe("sent");
    expect(update.data.attempts).toBe(2);
  });

  it("does NOT retry a permanent failure", async () => {
    mail.mockResolvedValue({ ok: false, error: "bad", retryable: false });
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t3",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: null,
    });
    expect(mail).toHaveBeenCalledTimes(1);
    const update = db.projectWorkflowEmail.update.mock.calls.at(-1)![0] as {
      data: { status: string };
    };
    expect(update.data.status).toBe("failed");
  });

  it("gives up after the attempt cap and logs the failure", async () => {
    mail.mockResolvedValue({ ok: false, error: "5xx", retryable: true });
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t4",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: null,
    });
    expect(mail).toHaveBeenCalledTimes(3);
    const update = db.projectWorkflowEmail.update.mock.calls.at(-1)![0] as {
      data: { status: string; error: string };
    };
    expect(update.data.status).toBe("failed");
    expect(update.data.error).toContain("5xx");
  });
});

// ── Routing + content ──
describe("stage routing and content", () => {
  it("notifies the requester (not approvers) when completed", async () => {
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t5",
      fromStatus: WORKFLOW_STATUS.APPROVED,
      toStatus: WORKFLOW_STATUS.COMPLETED,
      actorName: "Devon Dev",
      comment: "Shipped",
    });
    const claim = db.projectWorkflowEmail.create.mock.calls[0][0] as {
      data: { kind: string; recipient: string };
    };
    expect(claim.data.kind).toBe("decision_notice");
    expect(claim.data.recipient).toBe("dana@tbh.com");
  });

  it("notifies the requester on rejection", async () => {
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t6",
      fromStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      toStatus: WORKFLOW_STATUS.REJECTED,
      actorName: "Pat PM",
      comment: "Out of scope",
    });
    const claim = db.projectWorkflowEmail.create.mock.calls[0][0] as {
      data: { kind: string };
    };
    expect(claim.data.kind).toBe("decision_notice");
  });

  it("carries project, requester, priority and status into the email", async () => {
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t7",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: "Please review",
    });
    const sent = mail.mock.calls[0][0] as {
      variables: Record<string, string>;
      html: string;
    };
    expect(sent.variables.projectName).toBe("Payment gateway");
    expect(sent.variables.requesterName).toBe("Dana Requester");
    expect(sent.variables.priority).toBe("High");
    expect(sent.variables.status).toBe("Pending Approval");
    expect(sent.variables.deepLink).toContain("/projects/requests/p1");
    // One-click approve link is present because a secret is configured.
    expect(sent.variables.approveLink).toContain(
      "/api/project-workflow/email-action",
    );
  });

  it("escapes HTML in caller-supplied values", async () => {
    db.project.findUnique.mockResolvedValue({
      ...PROJECT,
      name: '<img src=x onerror="alert(1)">',
    });
    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t8",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: "<script>bad()</script>",
    });
    const sent = mail.mock.calls[0][0] as { html: string };
    expect(sent.html).not.toContain("<img src=x");
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).toContain("&lt;");
  });

  it("never lets a mail failure escape to the caller", async () => {
    db.project.findUnique.mockRejectedValue(new Error("db down"));
    await expect(
      workflowEmailService.onTransition({
        projectId: "p1",
        transitionId: "t9",
        fromStatus: WORKFLOW_STATUS.DRAFT,
        toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
        actorName: "Dana",
        comment: null,
      }),
    ).resolves.toBeUndefined();
  });
});

// The chain is what `workflowService.act` enforces via `chainService.canDecide`.
// If recipients came from anywhere else, we would email people the chain refuses
// and never reach the one person who can act.
describe("recipients follow the approval chain", () => {
  it("notifies the chain's current approver instead of permission holders", async () => {
    (
      chainService.currentApprovers as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([
      { id: "chain-approver", name: "Chain Approver", email: "chain@x.test" },
    ]);
    // Somebody else holds the stage permission — they must NOT be the recipient.
    db.user.findMany.mockResolvedValue([
      { id: "perm-holder", name: "Perm Holder", email: "perm@x.test" },
    ]);

    await workflowEmailService.onTransition({
      projectId: "p1",
      transitionId: "t10",
      fromStatus: WORKFLOW_STATUS.DRAFT,
      toStatus: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
      actorName: "Dana",
      comment: null,
    });

    const sent = mail.mock.calls[0][0] as { to: string };
    expect(sent.to).toBe("chain@x.test");
    expect(sent.to).not.toBe("perm@x.test");
  });
});
