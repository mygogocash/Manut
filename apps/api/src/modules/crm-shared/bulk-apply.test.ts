import { describe, expect, it, vi } from "vitest";

import { applyBulkBusinessUnits } from "@/modules/crm-shared/bulk-apply";

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const CTX = { module: "test", actorId: "actor" };

const row = (id: string, businessUnits: string[]) => ({ id, businessUnits });

describe("applyBulkBusinessUnits", () => {
  it("writes the computed set for each changed row", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await applyBulkBusinessUnits(
      [row("a", []), row("b", ["aria"])],
      ["onewave"],
      "add",
      write,
      CTX,
    );

    expect(result).toEqual({ updated: 2, skipped: 0, failed: [] });
    expect(write).toHaveBeenNthCalledWith(
      1,
      "a",
      ["onewave"],
      expect.anything(),
    );
    expect(write).toHaveBeenNthCalledWith(
      2,
      "b",
      ["aria", "onewave"],
      expect.anything(),
    );
  });

  it("skips rows that already carry the requested set, without writing", async () => {
    // Load-bearing for opportunities: a write there means a per-unit reconcile
    // plus a roll-up recompute.
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await applyBulkBusinessUnits(
      [row("a", ["onewave"]), row("b", [])],
      ["onewave"],
      "add",
      write,
      CTX,
    );

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("b", ["onewave"], expect.anything());
  });

  it("continues past a failing row and reports it", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Opportunity is already closed_lost."))
      .mockResolvedValueOnce(undefined);

    const result = await applyBulkBusinessUnits(
      [row("a", []), row("b", []), row("c", [])],
      ["onewave"],
      "add",
      write,
      CTX,
    );

    expect(result.updated).toBe(2);
    expect(result.failed).toEqual([
      { id: "b", reason: "Opportunity is already closed_lost." },
    ]);
    // The third row still ran — a failure must not abort the batch.
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("reports a non-Error throw without crashing", async () => {
    const write = vi.fn().mockRejectedValue("nope");
    const result = await applyBulkBusinessUnits(
      [row("a", [])],
      ["onewave"],
      "add",
      write,
      CTX,
    );
    expect(result.failed).toEqual([{ id: "a", reason: "Unknown error" }]);
  });

  it("applies replace semantics", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    await applyBulkBusinessUnits(
      [row("a", ["aria", "onewave"])],
      ["onewave-revenue"],
      "replace",
      write,
      CTX,
    );
    expect(write).toHaveBeenCalledWith(
      "a",
      ["onewave-revenue"],
      expect.anything(),
    );
  });

  it("writes sequentially, not concurrently", async () => {
    // Concurrent writes on opportunities would contend on the same child rows.
    const order: string[] = [];
    const write = vi.fn().mockImplementation(async (id: string) => {
      order.push(`start:${id}`);
      await new Promise((r) => setTimeout(r, 1));
      order.push(`end:${id}`);
    });

    await applyBulkBusinessUnits(
      [row("a", []), row("b", [])],
      ["onewave"],
      "add",
      write,
      CTX,
    );

    expect(order).toEqual(["start:a", "end:a", "start:b", "end:b"]);
  });

  it("handles an empty row set", async () => {
    const write = vi.fn();
    const result = await applyBulkBusinessUnits(
      [],
      ["onewave"],
      "add",
      write,
      CTX,
    );
    expect(result).toEqual({ updated: 0, skipped: 0, failed: [] });
    expect(write).not.toHaveBeenCalled();
  });
});
