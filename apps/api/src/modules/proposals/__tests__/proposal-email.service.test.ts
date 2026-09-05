import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { deliverEmail } from "@/infrastructure/email/email.service";
import { chainService } from "@/modules/approval-chains/chain.service";
import { PROPOSAL_STATUS } from "@/modules/proposals/proposal.types";
import { proposalEmailService } from "@/modules/proposals/proposal-email.service";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    proposal: { findUnique: vi.fn() },
    proposalEmail: {
      create: vi.fn((args) => ({ id: "e1", ...args.data })),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
  },
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  deliverEmail: vi.fn(),
}));

// The chain is the seam now: who reviews first is the first stage of the
// configured chain, and who a decision notifies is the record's pending stage.
// Mocked at the service rather than through prisma, so these tests stay about
// notification and not about chain storage.
vi.mock("@/modules/approval-chains/chain.service", () => ({
  chainService: {
    getChain: vi.fn(),
    currentApprovers: vi.fn(),
  },
}));

type M = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  proposal: { findUnique: M };
  proposalEmail: { create: M; update: M; findMany: M };
  user: { findUnique: M; findMany: M };
  systemSetting: { findUnique: M };
};
const send = deliverEmail as unknown as M;
const chain = chainService as unknown as {
  getChain: M;
  currentApprovers: M;
};

const RAISER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REVIEWER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LEGAL = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const USERS: Record<string, { id: string; name: string; email: string }> = {
  [RAISER]: { id: RAISER, name: "Priya", email: "priya@example.com" },
  [REVIEWER]: { id: REVIEWER, name: "Bhavin", email: "bhavin@example.com" },
  [LEGAL]: { id: LEGAL, name: "Legal Lead", email: "legal@example.com" },
};

/** Recipients actually mailed, lower-cased for comparison. */
const mailedTo = () =>
  send.mock.calls.map((c: [{ to: string }]) => c[0].to.toLowerCase()).sort();

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ ok: true });

  // clearAllMocks resets recorded calls but NOT implementations, so a test that
  // makes the claim reject would otherwise leak into every test after it.
  db.proposalEmail.create.mockImplementation(
    (args: { data: Record<string, unknown> }) => ({ id: "e1", ...args.data }),
  );
  db.proposalEmail.update.mockResolvedValue({ id: "e1" });

  db.proposal.findUnique.mockResolvedValue({
    id: "p1",
    title: "Wallet reconciliation",
    type: "idea",
    priority: "high",
    status: PROPOSAL_STATUS.PENDING_APPROVAL,
    raisedById: RAISER,
  });

  db.user.findUnique.mockImplementation(
    ({ where }: { where: { id: string } }) =>
      Promise.resolve(
        USERS[where.id] ? { ...USERS[where.id], isActive: true } : null,
      ),
  );

  // Stage 1 of the chain is Bhavin, so he is the standing CC.
  chain.getChain.mockResolvedValue({
    id: "c1",
    scope: "proposal",
    name: "Proposal approval",
    description: null,
    isActive: true,
    steps: [
      {
        id: "s1",
        order: 1,
        name: "First review",
        description: null,
        approver: { id: REVIEWER, name: "Bhavin", email: "bhavin@example.com" },
        approverMissing: false,
        isActive: true,
      },
    ],
  });
  chain.currentApprovers.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
});

// ── Duplicate prevention ──
describe("proposal email idempotency", () => {
  it("claims a unique key BEFORE sending", async () => {
    await proposalEmailService.onSubmitted("p1");
    expect(db.proposalEmail.create).toHaveBeenCalled();
    const claimOrder = db.proposalEmail.create.mock.invocationCallOrder[0];
    const sendOrder = send.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(sendOrder);
  });

  // The database constraint is what prevents a duplicate. A failed claim means
  // someone else already owns this notification, so this call must not send.
  it("does not send when the claim is rejected", async () => {
    db.proposalEmail.create.mockRejectedValue(new Error("unique violation"));
    await proposalEmailService.onSubmitted("p1");
    expect(send).not.toHaveBeenCalled();
  });

  it("keys a question notification per question, so two people both get one", async () => {
    await proposalEmailService.onQuestionsAsked("p1", [
      { id: "q1", assignedToId: LEGAL, question: "Contract position?" },
      { id: "q2", assignedToId: RAISER, question: "Expected saving?" },
    ]);
    const keys = db.proposalEmail.create.mock.calls.map(
      (c: [{ data: { idempotencyKey: string } }]) => c[0].data.idempotencyKey,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((k: string) => k.includes("q1"))).toBe(true);
    expect(keys.some((k: string) => k.includes("q2"))).toBe(true);
  });
});

// ── Retry ──
describe("proposal email retry", () => {
  it("retries a transient failure and then succeeds", async () => {
    send
      .mockResolvedValueOnce({ ok: false, retryable: true, error: "timeout" })
      .mockResolvedValueOnce({ ok: true });
    await proposalEmailService.onSubmitted("p1");
    expect(send).toHaveBeenCalledTimes(2);
    expect(db.proposalEmail.update.mock.calls[0][0].data.status).toBe("sent");
  });

  it("does NOT retry a permanent failure", async () => {
    send.mockResolvedValue({
      ok: false,
      retryable: false,
      error: "invalid address",
    });
    await proposalEmailService.onSubmitted("p1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.proposalEmail.update.mock.calls[0][0].data.status).toBe("failed");
  });

  it("gives up after the attempt cap and records the error", async () => {
    send.mockResolvedValue({ ok: false, retryable: true, error: "timeout" });
    await proposalEmailService.onSubmitted("p1");
    expect(send).toHaveBeenCalledTimes(3);
    const final = db.proposalEmail.update.mock.calls[0][0].data;
    expect(final.status).toBe("failed");
    expect(final.error).toBe("timeout");
  });
});

// ── The standing CC rule ──
//
// The first reviewer owns the flow and was explicitly asked to stay in the loop
// end to end. These tests exist because that is a rule someone could quietly
// break by adding a new notification.
describe("the first reviewer is copied on everything", () => {
  it("is the recipient of a new submission", async () => {
    await proposalEmailService.onSubmitted("p1");
    expect(mailedTo()).toEqual(["bhavin@example.com"]);
  });

  it("is copied when a question goes to someone else", async () => {
    await proposalEmailService.onQuestionsAsked("p1", [
      { id: "q1", assignedToId: LEGAL, question: "Contract position?" },
    ]);
    expect(mailedTo()).toEqual(["bhavin@example.com", "legal@example.com"]);
  });

  it("is copied when an answer comes back", async () => {
    await proposalEmailService.onAnswerReceived("p1", {
      id: "q1",
      askedById: REVIEWER,
      question: "Contract position?",
      response: "The contract allows it",
      answeredById: LEGAL,
    });
    expect(mailedTo()).toEqual(["bhavin@example.com"]);
  });

  it("is copied on the final decision to the requester", async () => {
    await proposalEmailService.onDecision("p1", {
      transitionId: "t1",
      toStatus: PROPOSAL_STATUS.APPROVED,
      choice: "pass",
      comment: null,
      actorId: REVIEWER,
    });
    expect(mailedTo()).toEqual(["bhavin@example.com", "priya@example.com"]);
  });

  // The reviewer is often the direct recipient too. Nobody should get the same
  // message twice.
  it("is not mailed twice when they are also the primary recipient", async () => {
    await proposalEmailService.onQuestionsAsked("p1", [
      { id: "q1", assignedToId: REVIEWER, question: "Something for myself" },
    ]);
    expect(mailedTo()).toEqual(["bhavin@example.com"]);
  });
});

// ── Routing by outcome ──
describe("decision routing", () => {
  it("notifies the next stage's approver when the chain advances", async () => {
    // The record's snapshot says stage 2 is waiting on Legal.
    chain.currentApprovers.mockResolvedValue([
      { id: LEGAL, name: "Legal Lead", email: "legal@example.com" },
    ]);
    await proposalEmailService.onDecision("p1", {
      transitionId: "t1",
      toStatus: PROPOSAL_STATUS.PENDING_APPROVAL,
      choice: "pass",
      comment: null,
      actorId: REVIEWER,
      advancedToStage: true,
    });
    // Whoever now owes the decision, plus the standing CC.
    expect(mailedTo()).toEqual(["bhavin@example.com", "legal@example.com"]);
  });

  // Read from the RECORD, not the live chain: a proposal in flight notifies who
  // it was actually routed to, even if an admin has since rewritten the chain.
  it("asks the record's snapshot who is waiting, not the chain", async () => {
    chain.currentApprovers.mockResolvedValue([
      { id: LEGAL, name: "Legal Lead", email: "legal@example.com" },
    ]);
    await proposalEmailService.onDecision("p1", {
      transitionId: "t1",
      toStatus: PROPOSAL_STATUS.PENDING_APPROVAL,
      choice: "pass",
      comment: null,
      actorId: REVIEWER,
      advancedToStage: true,
    });
    expect(chain.currentApprovers).toHaveBeenCalledWith({ proposalId: "p1" });
  });

  it("notifies the requester on a decline, with the reason", async () => {
    await proposalEmailService.onDecision("p1", {
      transitionId: "t1",
      toStatus: PROPOSAL_STATUS.DECLINED,
      choice: "decline",
      comment: "No budget line this year",
      actorId: REVIEWER,
    });
    expect(mailedTo()).toContain("priya@example.com");
    const html = send.mock.calls[0][0].html as string;
    expect(html).toContain("No budget line this year");
  });
});

// ── Content safety ──
describe("proposal email content", () => {
  it("escapes HTML in the title, question and answer", async () => {
    db.proposal.findUnique.mockResolvedValue({
      id: "p1",
      title: '<script>alert("t")</script>',
      type: "idea",
      priority: "high",
      status: PROPOSAL_STATUS.PENDING_APPROVAL,
      raisedById: RAISER,
    });
    await proposalEmailService.onQuestionsAsked("p1", [
      { id: "q1", assignedToId: LEGAL, question: "<img src=x onerror=1>" },
    ]);
    const html = send.mock.calls[0][0].html as string;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("carries the proposal type and priority for triage", async () => {
    await proposalEmailService.onSubmitted("p1");
    const html = send.mock.calls[0][0].html as string;
    expect(html).toContain("Idea");
    expect(html).toContain("High");
  });
});

// ── Failure isolation ──
describe("notification failures never affect the decision", () => {
  it("swallows a thrown error rather than propagating it", async () => {
    db.proposal.findUnique.mockRejectedValue(new Error("database gone"));
    await expect(
      proposalEmailService.onSubmitted("p1"),
    ).resolves.toBeUndefined();
  });

  it("does nothing quietly when the proposal has vanished", async () => {
    db.proposal.findUnique.mockResolvedValue(null);
    await proposalEmailService.onSubmitted("p1");
    expect(send).not.toHaveBeenCalled();
  });
});
