import { describe, expect, it } from "vitest";

import {
  buildCountVariance,
  type CountExpectation,
  normalizeTag,
  resolveAssetByTag,
} from "./fixed-asset-count";

const expectation = (
  over: Partial<CountExpectation> = {},
): CountExpectation => ({
  assetId: "a1",
  assetNo: "FA-FF-2026-001",
  name: "Office chair",
  categoryCode: "FF",
  location: "HQ 3F",
  expectedQuantity: 8,
  ...over,
});

describe("count tags", () => {
  it("normalises scanner noise — trailing newline, spaces, case", () => {
    // Keyboard-wedge scanners append Enter; label stock is printed mixed case.
    expect(normalizeTag(" fa-ff-2026-001 \n")).toBe("FA-FF-2026-001");
  });

  it("resolves a tag to its asset", () => {
    const r = resolveAssetByTag("FA-FF-2026-001", [
      { assetId: "a1", tag: "FA-FF-2026-001" },
      { assetId: "a2", tag: "FA-IT-2026-009" },
    ]);
    expect(r).toEqual({ assetId: "a1" });
  });

  it("returns null for an unknown tag rather than a best guess", () => {
    expect(resolveAssetByTag("NOPE", [{ assetId: "a1", tag: "X" }])).toBeNull();
  });

  it("reports ambiguity instead of picking one", () => {
    // serialNo is nullable, non-unique and never de-duplicated on import, so a
    // tag genuinely can hit two assets. Guessing attaches the count to the
    // wrong one and the counter confirms it.
    const r = resolveAssetByTag("DUP", [
      { assetId: "a1", tag: "DUP" },
      { assetId: "a2", tag: "dup" },
    ]);
    expect(r).toEqual({ ambiguous: true, count: 2 });
  });

  it("ignores assets with no tag", () => {
    expect(resolveAssetByTag("X", [{ assetId: "a1", tag: null }])).toBeNull();
  });
});

describe("count variance", () => {
  it("matches when the count equals the expectation", () => {
    const r = buildCountVariance(
      [expectation()],
      [{ assetId: "a1", countedQuantity: 8 }],
    );
    expect(r.lines[0]!.status).toBe("matched");
    expect(r.lines[0]!.suggestWriteOff).toBe(false);
    expect(r.summary.matched).toBe(1);
  });

  it("flags a shortfall and suggests a write-off without performing one", () => {
    // The suggestion routes into the existing disposal approval flow; letting a
    // counter's tap remove an asset would bypass approval, period locks and the
    // point-in-time snapshot.
    const r = buildCountVariance(
      [expectation()],
      [{ assetId: "a1", countedQuantity: 5 }],
    );
    expect(r.lines[0]!.status).toBe("shortfall");
    expect(r.lines[0]!.variance).toBe(-3);
    expect(r.lines[0]!.suggestWriteOff).toBe(true);
    expect(r.summary.netUnitsMissing).toBe(3);
  });

  it("flags a surplus but never suggests a write-off for it", () => {
    const r = buildCountVariance(
      [expectation()],
      [{ assetId: "a1", countedQuantity: 10 }],
    );
    expect(r.lines[0]!.status).toBe("surplus");
    expect(r.lines[0]!.suggestWriteOff).toBe(false);
  });

  it("distinguishes NOT COUNTED from counted-as-zero", () => {
    // A gap in the count is not an assertion that nothing was there. Treating
    // the two alike would write off every asset the counter never reached.
    const notCounted = buildCountVariance([expectation()], []);
    expect(notCounted.lines[0]!.status).toBe("not-counted");
    expect(notCounted.lines[0]!.suggestWriteOff).toBe(false);
    expect(notCounted.summary.netUnitsMissing).toBe(0);

    const countedZero = buildCountVariance(
      [expectation()],
      [{ assetId: "a1", countedQuantity: 0 }],
    );
    expect(countedZero.lines[0]!.status).toBe("shortfall");
    expect(countedZero.lines[0]!.suggestWriteOff).toBe(true);
    expect(countedZero.summary.netUnitsMissing).toBe(8);
  });

  it("sums observations from multiple counters instead of last-write-wins", () => {
    // Two people counting one room must not overwrite each other.
    const r = buildCountVariance(
      [expectation()],
      [
        { assetId: "a1", countedQuantity: 5 },
        { assetId: "a1", countedQuantity: 3 },
      ],
    );
    expect(r.lines[0]!.countedQuantity).toBe(8);
    expect(r.lines[0]!.status).toBe("matched");
  });

  it("records a found-but-unregistered asset without inventing a value", () => {
    const r = buildCountVariance(
      [],
      [
        {
          assetId: null,
          scannedTag: "UNKNOWN-42",
          countedQuantity: 1,
          note: "Monitor in meeting room",
        },
      ],
    );
    expect(r.lines[0]!.status).toBe("unregistered");
    expect(r.lines[0]!.name).toBe("Monitor in meeting room");
    expect(r.lines[0]!.expectedQuantity).toBe(0);
    expect(r.summary.unregistered).toBe(1);
  });

  it("summarises a mixed session", () => {
    const r = buildCountVariance(
      [
        expectation({ assetId: "a1", expectedQuantity: 8 }),
        expectation({ assetId: "a2", expectedQuantity: 2 }),
        expectation({ assetId: "a3", expectedQuantity: 1 }),
        expectation({ assetId: "a4", expectedQuantity: 5 }),
      ],
      [
        { assetId: "a1", countedQuantity: 8 },
        { assetId: "a2", countedQuantity: 1 },
        { assetId: "a3", countedQuantity: 3 },
        { assetId: null, countedQuantity: 1, note: "Stray printer" },
      ],
    );
    expect(r.summary).toMatchObject({
      expectedAssets: 4,
      matched: 1,
      shortfall: 1,
      surplus: 1,
      notCounted: 1,
      unregistered: 1,
      netUnitsMissing: 1,
    });
  });
});
