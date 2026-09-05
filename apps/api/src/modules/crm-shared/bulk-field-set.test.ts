import { describe, expect, it, vi } from "vitest";

import {
  applyBulkFieldSet,
  type BulkFieldRow,
} from "@/modules/crm-shared/bulk-field-set";

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const CTX = { module: "test", actorId: "actor" };
const row = (
  id: string,
  ownerId = "owner-a",
  archivedAt: Date | null = null,
  lifecycle = "qualified",
): BulkFieldRow => ({ id, ownerId, archivedAt, lifecycle });

function writers() {
  return {
    setOwner: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
    unarchive: vi.fn().mockResolvedValue(undefined),
    setLifecycle: vi.fn().mockResolvedValue(undefined),
  };
}

describe("applyBulkFieldSet — owner", () => {
  it("reassigns rows whose owner differs", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("a", "owner-a"), row("b", "owner-b")],
      { ownerId: "owner-b" },
      w,
      CTX,
    );
    expect(res).toEqual({ updated: 1, skipped: 1, failed: [] });
    expect(w.setOwner).toHaveBeenCalledExactlyOnceWith("a", "owner-b");
  });

  it("skips a row that already has the target owner", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("a", "owner-x")],
      { ownerId: "owner-x" },
      w,
      CTX,
    );
    expect(res.skipped).toBe(1);
    expect(w.setOwner).not.toHaveBeenCalled();
  });
});

describe("applyBulkFieldSet — archive", () => {
  it("archives active rows only", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("active"), row("already", "owner-a", new Date())],
      { archived: true },
      w,
      CTX,
    );
    expect(res).toEqual({ updated: 1, skipped: 1, failed: [] });
    expect(w.archive).toHaveBeenCalledExactlyOnceWith("active");
    expect(w.unarchive).not.toHaveBeenCalled();
  });

  it("unarchives archived rows only", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("archived", "owner-a", new Date()), row("active")],
      { archived: false },
      w,
      CTX,
    );
    expect(res.updated).toBe(1);
    expect(w.unarchive).toHaveBeenCalledExactlyOnceWith("archived");
    expect(w.archive).not.toHaveBeenCalled();
  });
});

describe("applyBulkFieldSet — combined + faults", () => {
  it("sets owner BEFORE archiving, within one row", async () => {
    // Reassigning an already-archived record would fight any archived-write
    // guard, and reassign-then-archive is the order a human would use.
    const order: string[] = [];
    const w = {
      setOwner: vi
        .fn()
        .mockImplementation(async () => void order.push("owner")),
      archive: vi
        .fn()
        .mockImplementation(async () => void order.push("archive")),
      unarchive: vi.fn(),
    };
    await applyBulkFieldSet(
      [row("a", "owner-a")],
      { ownerId: "owner-z", archived: true },
      w,
      CTX,
    );
    expect(order).toEqual(["owner", "archive"]);
  });

  it("counts a row once even when both fields change", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("a", "owner-a")],
      { ownerId: "owner-z", archived: true },
      w,
      CTX,
    );
    expect(res.updated).toBe(1);
  });

  it("continues past a failing row and reports it", async () => {
    const w = writers();
    w.archive
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Reopen first."))
      .mockResolvedValueOnce(undefined);

    const res = await applyBulkFieldSet(
      [row("ok1"), row("boom"), row("ok2")],
      { archived: true },
      w,
      CTX,
    );
    expect(res.updated).toBe(2);
    expect(res.failed).toEqual([{ id: "boom", reason: "Reopen first." }]);
    expect(w.archive).toHaveBeenCalledTimes(3);
  });

  it("skips every row when the set matches current state", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("a", "same"), row("b", "same")],
      { ownerId: "same", archived: false },
      w,
      CTX,
    );
    expect(res).toEqual({ updated: 0, skipped: 2, failed: [] });
  });

  it("handles an empty selection", async () => {
    const w = writers();
    const res = await applyBulkFieldSet([], { archived: true }, w, CTX);
    expect(res).toEqual({ updated: 0, skipped: 0, failed: [] });
  });
});

describe("applyBulkFieldSet — stage / status", () => {
  it("moves rows whose lifecycle differs", async () => {
    const w = writers();
    const res = await applyBulkFieldSet(
      [
        row("a", "owner-a", null, "qualified"),
        row("b", "owner-a", null, "proposal"),
      ],
      { lifecycle: "proposal" },
      w,
      CTX,
    );
    expect(res).toEqual({ updated: 1, skipped: 1, failed: [] });
    expect(w.setLifecycle).toHaveBeenCalledExactlyOnceWith("a", "proposal");
  });

  it("orders owner -> lifecycle -> archive within a row", async () => {
    // Archiving first would fight any archived-row write guard on the others.
    const order: string[] = [];
    const w = {
      setOwner: vi
        .fn()
        .mockImplementation(async () => void order.push("owner")),
      setLifecycle: vi
        .fn()
        .mockImplementation(async () => void order.push("lifecycle")),
      archive: vi
        .fn()
        .mockImplementation(async () => void order.push("archive")),
      unarchive: vi.fn(),
    };
    await applyBulkFieldSet(
      [row("a", "owner-a", null, "qualified")],
      { ownerId: "owner-z", lifecycle: "proposal", archived: true },
      w,
      CTX,
    );
    expect(order).toEqual(["owner", "lifecycle", "archive"]);
  });

  it("reports a guard refusal per row instead of bypassing it", async () => {
    // e.g. an opportunity that is closed_won and must be reopened first.
    const w = writers();
    w.setLifecycle.mockRejectedValueOnce(
      new Error("Cannot mark a closed_won opportunity as lost. Reopen first."),
    );
    const res = await applyBulkFieldSet(
      [row("won", "owner-a", null, "closed_won")],
      { lifecycle: "proposal" },
      w,
      CTX,
    );
    expect(res.updated).toBe(0);
    expect(res.failed[0]?.reason).toMatch(/Reopen first/);
  });

  it("fails the row when the type has no lifecycle writer", async () => {
    // Accounts: reported rather than silently ignored.
    const w = writers();
    const res = await applyBulkFieldSet(
      [row("a", "owner-a", null, "whatever")],
      { lifecycle: "proposal" },
      { ...w, setLifecycle: undefined },
      CTX,
    );
    expect(res.failed[0]?.reason).toMatch(/cannot change stage in bulk/i);
  });
});
