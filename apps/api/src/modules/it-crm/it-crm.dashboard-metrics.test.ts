import { describe, expect, it } from "vitest";

import { avgDays, computeSlaBlock } from "@/modules/it-crm/it-crm.service";

// Anchor times — only the gaps matter (hoursBetween is a difference), so a
// fixed UTC base keeps the assertions timezone-independent.
const base = new Date("2026-05-01T00:00:00.000Z");
const plusHours = (h: number) => new Date(base.getTime() + h * 3_600_000);
const plusDays = (d: number) => new Date(base.getTime() + d * 86_400_000);

describe("avgDays", () => {
  it("returns null for an empty sample", () => {
    expect(avgDays([])).toBeNull();
  });

  it("averages gaps in days, rounded to one decimal", () => {
    expect(
      avgDays([
        { from: base, to: plusDays(2) },
        { from: base, to: plusDays(4) },
      ]),
    ).toBe(3);
    expect(
      avgDays([
        { from: base, to: plusDays(1) },
        { from: base, to: plusDays(2) },
      ]),
    ).toBe(1.5);
  });
});

describe("computeSlaBlock", () => {
  it("returns null attainment when there is no sample", () => {
    const r = computeSlaBlock({ resolution: [], response: [] });
    expect(r.response.attainmentPct).toBeNull();
    expect(r.resolution.attainmentPct).toBeNull();
    expect(r.firstFix.firstFixPct).toBeNull();
    expect(r.resolution.total).toBe(0);
  });

  it("measures response against the per-priority target", () => {
    const r = computeSlaBlock({
      resolution: [],
      response: [
        // urgent response target = 1h
        {
          createdAt: base,
          firstResponseAt: plusHours(0.5),
          priority: "urgent",
        },
        { createdAt: base, firstResponseAt: plusHours(5), priority: "urgent" },
        // null first response is excluded from the denominator entirely
        { createdAt: base, firstResponseAt: null, priority: "high" },
      ],
    });
    expect(r.response.total).toBe(2);
    expect(r.response.met).toBe(1);
    expect(r.response.breached).toBe(1);
    expect(r.response.attainmentPct).toBe(50);
  });

  it("measures resolution + first-fix over resolved tickets only", () => {
    const r = computeSlaBlock({
      resolution: [
        // urgent resolution target = 4h — within, no reopen
        {
          createdAt: base,
          resolvedAt: plusHours(2),
          priority: "urgent",
          reopenedCount: 0,
        },
        // breached + reopened once
        {
          createdAt: base,
          resolvedAt: plusHours(10),
          priority: "urgent",
          reopenedCount: 1,
        },
        // unresolved → excluded from every resolution metric
        {
          createdAt: base,
          resolvedAt: null,
          priority: "low",
          reopenedCount: 0,
        },
      ],
      response: [],
    });
    expect(r.resolution.total).toBe(2);
    expect(r.resolution.met).toBe(1);
    expect(r.resolution.attainmentPct).toBe(50);
    expect(r.firstFix.total).toBe(2);
    expect(r.firstFix.clean).toBe(1);
    expect(r.firstFix.firstFixPct).toBe(50);
  });
});
