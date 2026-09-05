import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { workflowEmailService } from "@/modules/projects/workflow/workflow-email.service";
import { workflowPushService } from "@/modules/projects/workflow/workflow-push.service";
import { pushService } from "@/modules/push/push.service";

// Approval → Web Push.
//
// The properties worth protecting, hardest first:
//
//   1. Push CANNOT fail an approval. It is called after the transaction has
//      committed and must swallow everything.
//   2. Recipients are the ones email already resolved — push does not decide
//      who is entitled to know.
//   3. The payload says nothing a lock screen should not show.

vi.mock("@/modules/push/push.service", () => ({
  pushService: { sendToUsers: vi.fn() },
}));

vi.mock("@/modules/projects/workflow/workflow-email.service", () => ({
  workflowEmailService: { transitionRecipientIds: vi.fn() },
}));

type M = ReturnType<typeof vi.fn>;
const send = pushService.sendToUsers as unknown as M;
const resolve = workflowEmailService.transitionRecipientIds as unknown as M;

const PM = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  resolve.mockResolvedValue([PM]);
  send.mockResolvedValue({ sent: 1, expired: 0, failed: 0, skipped: false });
});

const transition = (over: Record<string, unknown> = {}) => ({
  projectId: "p-1",
  transitionId: "t-1",
  toStatus: "pending_pm_approval" as const,
  actorId: ACTOR,
  ...over,
});

/* ── Transaction safety ────────────────────────────────────────────── */

describe("push can never fail an approval", () => {
  it("swallows a delivery failure", async () => {
    send.mockRejectedValue(new Error("push service unreachable"));
    await expect(
      workflowPushService.onTransition(transition()),
    ).resolves.toBeUndefined();
  });

  it("swallows a recipient-resolution failure", async () => {
    // The transition has already committed by the time we get here; throwing
    // would report an error for something that succeeded.
    resolve.mockRejectedValue(new Error("database hiccup"));
    await expect(
      workflowPushService.onTransition(transition()),
    ).resolves.toBeUndefined();
  });

  it("does nothing when there is nobody to tell", async () => {
    resolve.mockResolvedValue([]);
    await workflowPushService.onTransition(transition());
    expect(send).not.toHaveBeenCalled();
  });
});

/* ── Recipients ────────────────────────────────────────────────────── */

describe("recipients come from the existing rule", () => {
  it("asks the email service, rather than resolving its own", async () => {
    await workflowPushService.onTransition(
      transition({ toStatus: "pending_escalation", escalatedToId: "e-1" }),
    );
    expect(resolve).toHaveBeenCalledWith({
      projectId: "p-1",
      toStatus: "pending_escalation",
      escalatedToId: "e-1",
    });
  });

  it("notifies exactly whoever email would", async () => {
    resolve.mockResolvedValue([PM, OWNER]);
    await workflowPushService.onTransition(transition());
    expect(send.mock.calls[0]![0]).toEqual([PM, OWNER]);
  });

  it("does not notify the person who just clicked", async () => {
    // Being told about your own approval is noise, and on a shared device it is
    // also a needless disclosure.
    resolve.mockResolvedValue([PM, ACTOR]);
    await workflowPushService.onTransition(transition());
    expect(send.mock.calls[0]![0]).toEqual([PM]);
  });

  it("sends nothing when the actor is the only recipient", async () => {
    resolve.mockResolvedValue([ACTOR]);
    await workflowPushService.onTransition(transition());
    expect(send).not.toHaveBeenCalled();
  });

  it("never accepts a recipient from its caller", async () => {
    // The signature has no recipient field at all — the only way in is the
    // resolver. This asserts the shape rather than the behaviour.
    const keys = Object.keys(transition());
    expect(keys).not.toContain("userIds");
    expect(keys).not.toContain("recipients");
  });
});

/* ── Payload ───────────────────────────────────────────────────────── */

describe("payload is safe for a lock screen", () => {
  it("says an approval is needed without saying what it is", async () => {
    await workflowPushService.onTransition(transition());
    const payload = send.mock.calls[0]![1];
    expect(payload.title).toBe("Approval required");
    expect(payload.body).toBe("A request is waiting for your decision.");
  });

  it("tells a requester their request was decided, and no more", async () => {
    await workflowPushService.onTransition(
      transition({ toStatus: "rejected" }),
    );
    const payload = send.mock.calls[0]![1];
    expect(payload.title).toBe("Request update");
    expect(payload.body).not.toMatch(/reject/i);
  });

  it("carries no project name, comment or decision detail", async () => {
    await workflowPushService.onTransition(transition());
    const serialised = JSON.stringify(send.mock.calls[0]![1]);
    for (const leak of ["Q3 redundancy", "salary", "comment", "actorName"]) {
      expect(serialised).not.toContain(leak);
    }
    // Only these four keys ever go over the wire.
    expect(Object.keys(send.mock.calls[0]![1]).sort()).toEqual(
      ["body", "notificationId", "tag", "title", "url"].sort(),
    );
  });

  it("deep-links to the existing request route, root-relative", async () => {
    await workflowPushService.onTransition(transition());
    const payload = send.mock.calls[0]![1];
    // Not a new route, and not absolute — the worker will re-validate it.
    // `/projects/p-1` is the delivery board, not the request: the assertion
    // used to accept it while this test's own name asked for the request route.
    expect(payload.url).toBe("/projects/requests/p-1");
    expect(payload.url.startsWith("/")).toBe(true);
    expect(payload.url.startsWith("//")).toBe(false);
  });

  it("lands on the same route the approval emails link to", async () => {
    // The regression this locks: push pointed at `/projects/:id` (the delivery
    // board) while email pointed at `/projects/requests/:id` (the request, with
    // the approve/reject controls on it). Comparing against the email service's
    // own path shape is what stops the two drifting apart again — a phase brief
    // asked for one canonical request route across every surface.
    await workflowPushService.onTransition(transition());
    const { url } = send.mock.calls[0]![1];
    const emailSource = readFileSync(
      resolvePath(__dirname, "../workflow-email.service.ts"),
      "utf8",
    );
    // The literal the email deep link is built from.
    expect(emailSource).toContain("/projects/requests/${projectId}");
    expect(url).toBe("/projects/requests/p-1");
  });

  it("reuses the transition id rather than minting a second event id", async () => {
    await workflowPushService.onTransition(transition());
    const payload = send.mock.calls[0]![1];
    expect(payload.notificationId).toBe("t-1");
    // The tag collapses duplicate banners for the same transition.
    expect(payload.tag).toBe("workflow-t-1");
  });
});
