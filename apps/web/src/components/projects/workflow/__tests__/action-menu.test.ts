import { describe, expect, it } from "vitest";

import {
  ACTION_ORDER,
  buildActionMenu,
  DESTRUCTIVE,
  isStaleViewError,
} from "@/components/projects/workflow/workflow-actions";
import { ApiError } from "@/lib/api-client";
import type { WorkflowAction } from "@/services/workflow.service";

// The two rules a row of buttons could not enforce.
//
// Before this, a request offering four actions rendered them in whatever order
// the API returned, wrapped onto two lines, with Reject the same weight and
// often the same position as Approve. Both rules below exist so a reviewer
// clicking quickly down a queue cannot hit the wrong one because the layout
// moved.

describe("menu order is stable, not API order", () => {
  it("orders by intent regardless of the order given", () => {
    const forwards: WorkflowAction[] = ["approve", "escalate", "reject"];
    const backwards: WorkflowAction[] = ["reject", "escalate", "approve"];

    const a = buildActionMenu(forwards);
    const b = buildActionMenu(backwards);

    expect([...a.routine, ...a.destructive]).toEqual([
      ...b.routine,
      ...b.destructive,
    ]);
    expect(a.routine).toEqual(["approve", "escalate"]);
  });

  it("puts every routine action ahead of the destructive one", () => {
    const { routine, destructive } = buildActionMenu([
      "reject",
      "return",
      "approve",
      "escalate",
    ]);
    expect(destructive).toEqual(["reject"]);
    // Reject is last, so it is never where Approve was a moment ago.
    expect(routine.at(-1)).not.toBe("reject");
    expect(routine).toEqual(["approve", "escalate", "return"]);
  });

  it("covers every action the API can offer, so none is silently dropped", () => {
    const every = [...ACTION_ORDER];
    const { routine, destructive } = buildActionMenu(every);
    expect([...routine, ...destructive].sort()).toEqual([...every].sort());
  });
});

describe("split layout", () => {
  it("promotes the most routine action to a button", () => {
    const { promoted, routine, destructive } = buildActionMenu(
      ["reject", "escalate", "approve"],
      "split",
    );
    expect(promoted).toBe("approve");
    // Promoted action is not repeated inside the menu.
    expect(routine).not.toContain("approve");
    expect(routine).toEqual(["escalate"]);
    expect(destructive).toEqual(["reject"]);
  });

  // A request whose only action is destructive must not promote it: a button
  // labelled Reject sitting where Approve normally is invites a misclick.
  it("promotes nothing when the only action is destructive", () => {
    const { promoted, destructive } = buildActionMenu(["reject"], "split");
    expect(promoted).toBeUndefined();
    expect(destructive).toEqual(["reject"]);
  });

  it("leaves the menu empty when the only action is promoted", () => {
    const { promoted, routine, destructive } = buildActionMenu(
      ["submit"],
      "split",
    );
    expect(promoted).toBe("submit");
    expect([...routine, ...destructive]).toEqual([]);
  });
});

describe("menu layout", () => {
  it("promotes nothing, so every action sits in one place", () => {
    const { promoted, routine } = buildActionMenu(["approve", "reject"]);
    expect(promoted).toBeUndefined();
    expect(routine).toEqual(["approve"]);
  });

  it("returns nothing for a request with no available actions", () => {
    const { promoted, routine, destructive } = buildActionMenu([]);
    expect(promoted).toBeUndefined();
    expect([...routine, ...destructive]).toEqual([]);
  });
});

describe("severity", () => {
  it("treats reject, and only reject, as destructive", () => {
    // Returning for changes is recoverable; rejecting is the one that ends it.
    expect(DESTRUCTIVE).toEqual(["reject"]);
  });
});

/* --- Two people, one request ---------------------------------------- */
//
// Both approvers have the same pending request open. One decides it; the
// other's click now fails. The failure is not the problem - showing the error
// and leaving the stale row on screen is, because the only thing left to do
// with it is click the same dead action again.

describe("a failure that means the view is out of date", () => {
  const err = (status: number) =>
    new ApiError(status, "code", "message");

  it("treats a lost race for the stage as stale", () => {
    // 409 from the chain's conditional update: somebody settled it first.
    expect(isStaleViewError(err(409))).toBe(true);
  });

  it("treats an illegal transition as stale", () => {
    // 400 from the state machine - "cannot approve a project that is
    // Approved" only happens because our copy of the status is old.
    expect(isStaleViewError(err(400))).toBe(true);
  });

  it("treats the stage having moved to somebody else as stale", () => {
    expect(isStaleViewError(err(403))).toBe(true);
  });

  it("treats a vanished request as stale", () => {
    expect(isStaleViewError(err(404))).toBe(true);
  });

  it("does NOT refetch on a server fault", () => {
    // Nothing about a 500 says the record moved, and refetching on every
    // transport blip is how a retry loop starts.
    expect(isStaleViewError(err(500))).toBe(false);
    expect(isStaleViewError(err(502))).toBe(false);
  });

  it("does NOT refetch on a network failure", () => {
    expect(isStaleViewError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleViewError(undefined)).toBe(false);
  });
});
