import { describe, expect, it } from "vitest";

import { resolveLayout } from "@/components/shared/use-table-layout";

const CODE = {
  order: ["date", "avg", "vs28", "vsPrev"],
  hidden: [] as string[],
  widths: {} as Record<string, number>,
  rowOrder: [] as string[],
};

/** Layout literals in these tests only vary the fields under test. */
function layout(partial: Partial<typeof CODE>) {
  return { order: [], hidden: [], widths: {}, rowOrder: [], ...partial };
}

describe("resolveLayout", () => {
  it("returns code defaults when neither layer is set", () => {
    expect(resolveLayout(CODE, null, null)).toEqual(CODE);
  });

  it("applies the admin default over code", () => {
    const admin = layout({
      order: ["avg", "date", "vs28", "vsPrev"],
      hidden: ["vs28"],
      widths: { date: 120 },
    });
    const r = resolveLayout(CODE, admin, null);
    expect(r.order).toEqual(["avg", "date", "vs28", "vsPrev"]);
    expect(r.hidden).toEqual(["vs28"]);
    expect(r.widths).toEqual({ date: 120 });
  });

  it("lets the user override the admin default", () => {
    const admin = layout({
      order: ["avg", "date", "vs28", "vsPrev"],
      hidden: ["vs28"],
      widths: {},
    });
    const user = layout({
      order: ["vsPrev", "date", "avg", "vs28"],
      hidden: [],
      widths: { avg: 200 },
    });
    const r = resolveLayout(CODE, admin, user);
    expect(r.order[0]).toBe("vsPrev");
    expect(r.hidden).toEqual([]);
    expect(r.widths).toEqual({ avg: 200 });
  });

  /**
   * Documents a sharp edge rather than endorsing it. `mergeStoredColumnOrder`
   * exists to slot a NEWLY ADDED column into an otherwise complete stored
   * order, so it positions anything absent by code adjacency. Hand a
   * deliberately partial order in and the unnamed columns interleave rather
   * than trailing the named ones.
   *
   * This never happens through the UI — `reorder` persists the whole order and
   * `saveAsDefault` sends the full resolved layout — but a hand-written PUT
   * could do it, and the behaviour should be a known quantity, not a surprise.
   */
  it("completes a partial order by code adjacency, not by appending", () => {
    const admin = layout({ order: ["avg", "date"], hidden: [], widths: {} });
    const r = resolveLayout(CODE, admin, null);
    expect(r.order).toEqual(["avg", "vs28", "vsPrev", "date"]);
    expect(r.order).toHaveLength(CODE.order.length);
  });

  it("falls through per field, so an admin reorder keeps user widths", () => {
    const admin = layout({ order: ["vsPrev", "date"], hidden: [], widths: {} });
    const user = layout({ order: [], hidden: [], widths: { date: 300 } });
    const r = resolveLayout(CODE, admin, user);
    expect(r.order[0]).toBe("vsPrev");
    expect(r.widths).toEqual({ date: 300 });
  });

  it("ignores keys the table no longer defines", () => {
    const admin = layout({
      order: ["removed", "avg"],
      hidden: ["removed"],
      widths: {},
    });
    const r = resolveLayout(CODE, admin, null);
    expect(r.order).not.toContain("removed");
    expect(r.hidden).not.toContain("removed");
    expect(r.order).toHaveLength(CODE.order.length);
  });

  it("never drops a column the code default added after a layout was saved", () => {
    const saved = layout({
      order: ["date", "avg", "vs28"],
      hidden: [],
      widths: {},
    });
    const r = resolveLayout(CODE, saved, null);
    expect(r.order).toContain("vsPrev");
  });
});

describe("resolveLayout — row order", () => {
  it("has no row order until one is saved", () => {
    expect(resolveLayout(CODE, null, null).rowOrder).toEqual([]);
  });

  it("prefers the user's row order over the admin default", () => {
    const admin = layout({ rowOrder: ["a", "b"] });
    const user = layout({ rowOrder: ["b", "a"] });
    expect(resolveLayout(CODE, admin, user).rowOrder).toEqual(["b", "a"]);
  });

  it("falls back to the admin row order when the user has none", () => {
    const admin = layout({ rowOrder: ["c", "a", "b"] });
    const user = layout({ widths: { avg: 120 } });
    expect(resolveLayout(CODE, admin, user).rowOrder).toEqual(["c", "a", "b"]);
  });

  it("keeps row keys the code layout knows nothing about", () => {
    // Row keys are DATA, not schema: unlike columns they are not filtered
    // against the code layout, or a narrower date range would silently forget
    // the reader's arrangement.
    const admin = layout({ rowOrder: ["2026-06-01", "2026-06-02"] });
    expect(resolveLayout(CODE, admin, null).rowOrder).toEqual([
      "2026-06-01",
      "2026-06-02",
    ]);
  });
});
