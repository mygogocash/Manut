import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { computeDepreciation } from "./fixed-asset-depreciation";
import {
  assetAsOf,
  type AssetEvent,
  assetStateAt,
  disposalToEvent,
  groupEventsByAsset,
  heldAt,
  toDepreciationInput,
} from "./fixed-asset-state";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: string) => new Prisma.Decimal(n);

// Worked example 3 from the PRD: 8 office chairs, 3 disposed on 2026-12-31.
const CHAIRS = {
  purchasePrice: dec("20859.84"),
  quantity: 8,
  startDate: d("2025-02-06"),
  usefulLifeMonths: 60,
  openingBookValue: null,
  openingAsOfDate: null,
};

// The live row AFTER that partial disposal: qty 5, cost reduced pro rata.
const CHAIRS_AFTER = {
  ...CHAIRS,
  purchasePrice: dec("13037.40"),
  quantity: 5,
};

const DISPOSAL_EVENT: AssetEvent = {
  kind: "disposal",
  effectiveDate: d("2026-12-31"),
  quantityBefore: 8,
  costBefore: dec("20859.84"),
  openingBookValueBefore: null,
};

describe("fixed asset state — point-in-time reconstruction", () => {
  it("valuing a date before the event rebuilds the pre-event cost and quantity", () => {
    const state = assetStateAt(CHAIRS_AFTER, [DISPOSAL_EVENT], d("2026-06-30"));
    expect(state.purchasePrice).toBe("20859.84");
    expect(state.quantity).toBe(8);
  });

  it("valuing a date after the event uses the live (reduced) row", () => {
    const state = assetStateAt(CHAIRS_AFTER, [DISPOSAL_EVENT], d("2027-01-01"));
    expect(state.purchasePrice).toBe("13037.4");
    expect(state.quantity).toBe(5);
  });

  it("the event date itself is already post-event (events are strictly after)", () => {
    const state = assetStateAt(CHAIRS_AFTER, [DISPOSAL_EVENT], d("2026-12-31"));
    expect(state.quantity).toBe(5);
  });

  it("rebuilt state reproduces the original depreciation exactly", () => {
    const asIfNeverDisposed = computeDepreciation(
      toDepreciationInput(CHAIRS),
      d("2026-06-30"),
    );
    const rebuilt = computeDepreciation(
      assetStateAt(CHAIRS_AFTER, [DISPOSAL_EVENT], d("2026-06-30")),
      d("2026-06-30"),
    );
    expect(rebuilt.netBookValue.toFixed(2)).toBe(
      asIfNeverDisposed.netBookValue.toFixed(2),
    );
    expect(rebuilt.accumulatedDepreciation.toFixed(2)).toBe(
      asIfNeverDisposed.accumulatedDepreciation.toFixed(2),
    );
  });

  it("falls back to the live row when no event follows the date", () => {
    const state = assetStateAt(CHAIRS_AFTER, [], d("2026-06-30"));
    expect(state.purchasePrice).toBe("13037.4");
    expect(state.quantity).toBe(5);
  });

  it("ignores a legacy event with no snapshot rather than blanking the cost", () => {
    const legacy: AssetEvent = {
      kind: "disposal",
      effectiveDate: d("2026-12-31"),
      quantityBefore: null,
      costBefore: null,
      openingBookValueBefore: null,
    };
    const state = assetStateAt(CHAIRS_AFTER, [legacy], d("2026-06-30"));
    expect(state.purchasePrice).toBe("13037.4");
  });
});

describe("fixed asset state — multiple events (the Phase 2 regression)", () => {
  // Two partial disposals. Valuing a date before BOTH must rebuild to the
  // earliest one's snapshot — the later event's snapshot already reflects the
  // earlier one, so picking the wrong event double-counts the reduction.
  const first: AssetEvent = {
    kind: "disposal",
    effectiveDate: d("2026-06-30"),
    quantityBefore: 8,
    costBefore: dec("20859.84"),
    openingBookValueBefore: null,
  };
  const second: AssetEvent = {
    kind: "disposal",
    effectiveDate: d("2026-12-31"),
    quantityBefore: 6,
    costBefore: dec("15644.88"),
    openingBookValueBefore: null,
  };

  it("picks the EARLIEST event after the date, not the first in the array", () => {
    // Deliberately unsorted — the helper must not rely on input order.
    const state = assetStateAt(CHAIRS_AFTER, [second, first], d("2026-01-01"));
    expect(state.quantity).toBe(8);
    expect(state.purchasePrice).toBe("20859.84");
  });

  it("between the two events, rebuilds to the later event's snapshot", () => {
    const state = assetStateAt(CHAIRS_AFTER, [second, first], d("2026-09-30"));
    expect(state.quantity).toBe(6);
    expect(state.purchasePrice).toBe("15644.88");
  });

  it("a mixed event chain is kind-agnostic — impairment wins if it is earlier", () => {
    const impairment: AssetEvent = {
      kind: "impairment",
      effectiveDate: d("2026-03-31"),
      quantityBefore: 8,
      costBefore: dec("20859.84"),
      openingBookValueBefore: dec("18000.00"),
      openingAsOfDateBefore: d("2025-12-31"),
    };
    const state = assetStateAt(
      CHAIRS_AFTER,
      [second, first, impairment],
      d("2026-01-01"),
    );
    expect(state.openingBookValue).toBe("18000");
    expect(state.openingAsOfDate).toEqual(d("2025-12-31"));
  });
});

describe("fixed asset state — cut-over anchor handling", () => {
  const anchored = {
    purchasePrice: dec("44800"),
    quantity: 1,
    startDate: d("2024-05-17"),
    usefulLifeMonths: 36,
    openingBookValue: dec("20539"),
    openingAsOfDate: d("2025-12-31"),
  };

  it("an event carrying its own anchor date wins over the live value", () => {
    // An impairment re-anchors the asset, so the pre-impairment report must use
    // the anchor that was in force THEN, not the one the impairment installed.
    const event: AssetEvent = {
      kind: "impairment",
      effectiveDate: d("2027-06-30"),
      quantityBefore: 1,
      costBefore: dec("44800"),
      openingBookValueBefore: dec("20539"),
      openingAsOfDateBefore: d("2025-12-31"),
    };
    const state = assetStateAt(
      { ...anchored, openingAsOfDate: d("2027-06-30") },
      [event],
      d("2026-06-30"),
    );
    expect(state.openingAsOfDate).toEqual(d("2025-12-31"));
  });

  it("keeps the anchor pair all-or-nothing", () => {
    const event: AssetEvent = {
      kind: "disposal",
      effectiveDate: d("2027-01-01"),
      quantityBefore: 1,
      costBefore: dec("44800"),
      openingBookValueBefore: null,
    };
    const state = assetStateAt(anchored, [event], d("2026-06-30"));
    // No anchor value snapshotted → the date must be dropped too, or the engine
    // would anchor at a date with no value.
    expect(state.openingBookValue).toBeNull();
    expect(state.openingAsOfDate).toBeNull();
  });
});

describe("fixed asset state — lifecycle helpers", () => {
  it("assetAsOf clamps the valuation date to the disposal date", () => {
    const asset = { disposalDate: d("2026-06-30"), status: "disposed" };
    expect(assetAsOf(asset, d("2026-12-31"))).toEqual(d("2026-06-30"));
    expect(assetAsOf(asset, d("2026-01-01"))).toEqual(d("2026-01-01"));
  });

  it("assetAsOf leaves a live asset's date alone", () => {
    const asset = { disposalDate: null, status: "active" };
    expect(assetAsOf(asset, d("2026-12-31"))).toEqual(d("2026-12-31"));
  });

  it("heldAt is true for a disposed asset at a date before its disposal", () => {
    const asset = { disposalDate: d("2026-06-30"), status: "disposed" };
    expect(heldAt(asset, d("2026-01-01"))).toBe(true);
    expect(heldAt(asset, d("2026-12-31"))).toBe(false);
  });

  it("heldAt falls back to status when the asset was never disposed", () => {
    expect(
      heldAt({ disposalDate: null, status: "active" }, d("2026-01-01")),
    ).toBe(true);
    expect(
      heldAt({ disposalDate: null, status: "idle" }, d("2026-01-01")),
    ).toBe(true);
    expect(
      heldAt({ disposalDate: null, status: "written_off" }, d("2026-01-01")),
    ).toBe(false);
  });
});

describe("fixed asset state — adapters", () => {
  it("disposalToEvent maps the snapshot columns and leaves the anchor date live", () => {
    const event = disposalToEvent({
      assetId: "a1",
      disposalDate: d("2026-12-31"),
      quantityBefore: 8,
      costBefore: dec("20859.84"),
      openingBookValueBefore: null,
    });
    expect(event.kind).toBe("disposal");
    expect(event.effectiveDate).toEqual(d("2026-12-31"));
    expect(event.quantityBefore).toBe(8);
    expect(event.openingAsOfDateBefore).toBeNull();
  });

  it("groupEventsByAsset buckets by asset id", () => {
    const grouped = groupEventsByAsset([
      { ...DISPOSAL_EVENT, assetId: "a1" },
      { ...DISPOSAL_EVENT, assetId: "a2" },
      { ...DISPOSAL_EVENT, assetId: "a1" },
    ]);
    expect(grouped.get("a1")).toHaveLength(2);
    expect(grouped.get("a2")).toHaveLength(1);
    expect(grouped.get("nope")).toBeUndefined();
  });
});
