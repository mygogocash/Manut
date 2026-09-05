import { describe, expect, it } from "vitest";

import {
  normalizeLayout,
  TABLE_LAYOUT_KEY_PREFIX,
} from "@/modules/table-layouts/table-layouts.service";
import { tableIdSchema } from "@/modules/table-layouts/table-layouts.validation";

describe("table layout normalisation", () => {
  it("keys a layout under a stable prefix", () => {
    expect(TABLE_LAYOUT_KEY_PREFIX + "ma-trend-detail").toBe(
      "table-layout.ma-trend-detail",
    );
  });

  it("drops junk and clamps widths to the minimum", () => {
    expect(
      normalizeLayout({
        order: ["date", 42, "day"],
        hidden: ["day", null],
        widths: { date: 10, day: 180, bogus: "x" },
      }),
    ).toEqual({
      order: ["date", "day"],
      hidden: ["day"],
      widths: { date: 56, day: 180 },
      rowOrder: [],
    });
  });

  it("returns empty structures for a null or non-object row", () => {
    const empty = { order: [], hidden: [], widths: {}, rowOrder: [] };
    expect(normalizeLayout(null)).toEqual(empty);
    expect(normalizeLayout([1, 2])).toEqual(empty);
    expect(normalizeLayout("nope")).toEqual(empty);
  });

  it("rounds fractional widths rather than storing them raw", () => {
    expect(normalizeLayout({ widths: { date: 120.4 } }).widths).toEqual({
      date: 120,
    });
  });
});

describe("router wiring", () => {
  it("exposes exactly get/put/delete on /:tableId", async () => {
    const { default: router } =
      await import("@/modules/table-layouts/table-layouts.controller");
    const layers = (
      router as unknown as {
        stack: { route?: { path: string; methods: Record<string, boolean> } }[];
      }
    ).stack.filter((l) => l.route);
    const routes = layers.map((l) => ({
      path: l.route!.path,
      methods: Object.keys(l.route!.methods).sort(),
    }));

    expect(routes).toEqual([
      { path: "/:tableId", methods: ["get"] },
      { path: "/:tableId", methods: ["put"] },
      { path: "/:tableId", methods: ["delete"] },
    ]);
  });
});

describe("row order", () => {
  it("keeps row keys and drops non-strings", () => {
    expect(
      normalizeLayout({ rowOrder: ["telkomsel", 7, "u9", null] }).rowOrder,
    ).toEqual(["telkomsel", "u9"]);
  });

  it("defaults to an empty row order when absent", () => {
    expect(normalizeLayout({ order: ["a"] }).rowOrder).toEqual([]);
  });
});

describe("tableId guard", () => {
  it("accepts kebab-case ids", () => {
    expect(tableIdSchema.safeParse("ma-trend-detail").success).toBe(true);
    expect(tableIdSchema.safeParse("ma-overview").success).toBe(true);
  });

  // The id becomes part of a SystemSetting primary key, so it must not be
  // able to address another module's row (e.g. payslip.company).
  it("rejects ids that could escape the key namespace", () => {
    for (const bad of ["../admin", "a.b", "A_B", "payslip.company", ""]) {
      expect(tableIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects an id long enough to overflow the VarChar(100) key column", () => {
    expect(tableIdSchema.safeParse("a".repeat(65)).success).toBe(false);
  });
});
