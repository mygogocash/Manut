import { describe, expect, it } from "vitest";

import { pickRung } from "@/modules/crm-shared/crm-reminders";

const PROJECT_RUNGS = [30, 14, 7, 1] as const;

describe("pickRung — deadline ladder", () => {
  it("returns null when the deadline is beyond the widest rung", () => {
    expect(pickRung(45, PROJECT_RUNGS, new Set(), "golive")).toBeNull();
  });

  it("fires the tightest rung reached and covers the larger passed rungs", () => {
    // 5 days out entered the window late → fire the 7 rung, cover 30/14/7 so
    // 30/14 never replay on later days.
    const r = pickRung(5, PROJECT_RUNGS, new Set(), "golive");
    expect(r?.fired).toBe("golive-7");
    expect(r?.markers.sort()).toEqual(
      ["golive-14", "golive-30", "golive-7"].sort(),
    );
  });

  it("fires the exact rung when the deadline lands on a boundary", () => {
    const r = pickRung(30, PROJECT_RUNGS, new Set(), "golive");
    expect(r?.fired).toBe("golive-30");
    expect(r?.markers).toEqual(["golive-30"]);
  });

  it("advances to the next unfired rung on later days", () => {
    // 30/14/7 already covered; at 1 day out fire the 1 rung. `markers` re-lists
    // the covered larger rungs too (harmless — the worker Set-dedupes), so we
    // assert the fired rung + that "golive-1" is now covered.
    const sent = new Set(["golive-30", "golive-14", "golive-7"]);
    const r = pickRung(1, PROJECT_RUNGS, sent, "golive");
    expect(r?.fired).toBe("golive-1");
    expect(r?.markers).toContain("golive-1");
  });

  it("does not re-fire an already-fired rung (idempotent)", () => {
    const sent = new Set(["golive-30", "golive-14", "golive-7"]);
    expect(pickRung(5, PROJECT_RUNGS, sent, "golive")).toBeNull();
  });

  it("fires a single overdue marker once when past due", () => {
    const r = pickRung(-3, PROJECT_RUNGS, new Set(), "golive");
    expect(r?.fired).toBe("golive-overdue");
    expect(r?.markers).toEqual(["golive-overdue"]);
    expect(
      pickRung(-10, PROJECT_RUNGS, new Set(["golive-overdue"]), "golive"),
    ).toBeNull();
  });

  it("treats due-today (0 days) as the tightest rung", () => {
    const r = pickRung(0, PROJECT_RUNGS, new Set(), "golive");
    expect(r?.fired).toBe("golive-1");
  });
});
