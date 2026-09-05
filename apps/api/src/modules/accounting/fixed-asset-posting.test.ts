import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { fixedAssetDepreciationRunSchema } from "./accounting.validation";
import {
  computeDepreciation,
  computeDisposal,
  periodDepreciationCharge,
} from "./fixed-asset-depreciation";
import {
  assertBalanced,
  normalizeLines,
  type PostingLine,
} from "./gl-posting.service";
import {
  buildFixedAssetDepreciationLines,
  buildFixedAssetDisposalLines,
} from "./posting-builders";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const D = Prisma.Decimal;

const DEP_ACC = {
  depreciationExpense: "exp",
  accumulatedDepreciation: "accum",
};

const DISP_ACC = {
  assetCost: "cost",
  accumulatedDepreciation: "accum",
  disposalGain: "gain",
  disposalLoss: "loss",
  proceedsClearing: "clearing",
};

/** Σdebit must equal Σcredit exactly — assertBalanced allows no epsilon. */
const expectBalanced = (lines: PostingLine[]) =>
  expect(() => assertBalanced(normalizeLines(lines))).not.toThrow();

// PRD worked example 4: post cut-over asset, 13,150 over 60 months.
const POST_CUTOVER = {
  purchasePrice: 13150,
  quantity: 1,
  startDate: d("2026-01-13"),
  usefulLifeMonths: 60,
};

describe("period depreciation charge", () => {
  const state = (s: typeof POST_CUTOVER) => s;

  it("is the difference between two point-in-time accumulations", () => {
    const charge = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2026-01-31") },
      { state: state(POST_CUTOVER), asOf: d("2026-02-28") },
    );
    const jan = computeDepreciation(POST_CUTOVER, d("2026-01-31"));
    const feb = computeDepreciation(POST_CUTOVER, d("2026-02-28"));
    expect(charge.toFixed(2)).toBe(
      feb.accumulatedDepreciation.minus(jan.accumulatedDepreciation).toFixed(2),
    );
    expect(Number(charge)).toBeGreaterThan(0);
  });

  it("charges nothing for a month entirely before the asset was in service", () => {
    const charge = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2025-11-30") },
      { state: state(POST_CUTOVER), asOf: d("2025-12-31") },
    );
    expect(charge.toFixed(2)).toBe("0.00");
  });

  it("charges only from the start date in the month the asset enters service", () => {
    // Opening is the day before the asset exists; closing is month-end. The
    // charge must equal the whole accumulation to date, not a full month.
    const charge = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2025-12-31") },
      { state: state(POST_CUTOVER), asOf: d("2026-01-31") },
    );
    const jan = computeDepreciation(POST_CUTOVER, d("2026-01-31"));
    expect(charge.toFixed(2)).toBe(jan.accumulatedDepreciation.toFixed(2));
  });

  it("charges nothing once the asset is fully depreciated (memo floor)", () => {
    // Life ends 2031-01-13; both points are past it, so accumulated is pinned
    // at cost − memo and the difference is exactly zero.
    const charge = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2031-06-30") },
      { state: state(POST_CUTOVER), asOf: d("2031-07-31") },
    );
    expect(charge.toFixed(2)).toBe("0.00");
  });

  it("the final period's charge tops up to exactly cost − memo", () => {
    const before = computeDepreciation(POST_CUTOVER, d("2030-12-31"));
    const charge = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2030-12-31") },
      { state: state(POST_CUTOVER), asOf: d("2031-01-13") },
    );
    expect(before.accumulatedDepreciation.plus(charge).toFixed(2)).toBe(
      "13149.00",
    );
  });

  it("is negative for a contra line, and is not clamped", () => {
    // PRD worked example 2: a credit note depreciates as a negative asset, so
    // its period charge RELEASES a credit. Clamping at zero would silently drop
    // the release and overstate the expense.
    const creditNote = {
      purchasePrice: -12900,
      quantity: 1,
      startDate: d("2024-12-17"),
      usefulLifeMonths: 60,
    };
    const charge = periodDepreciationCharge(
      { state: creditNote, asOf: d("2026-01-31") },
      { state: creditNote, asOf: d("2026-02-28") },
    );
    expect(Number(charge)).toBeLessThan(0);
  });

  it("stops at the disposal date when the closing date is clamped", () => {
    // assetAsOf clamps the closing valuation to the disposal date; the charge
    // must then cover only the pre-disposal part of the month.
    const full = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2026-06-30") },
      { state: state(POST_CUTOVER), asOf: d("2026-07-31") },
    );
    const clamped = periodDepreciationCharge(
      { state: state(POST_CUTOVER), asOf: d("2026-06-30") },
      { state: state(POST_CUTOVER), asOf: d("2026-07-15") },
    );
    expect(Number(clamped)).toBeGreaterThan(0);
    expect(Number(clamped)).toBeLessThan(Number(full));
  });
});

describe("depreciation posting lines", () => {
  it("debits expense and credits accumulated depreciation", () => {
    const lines = buildFixedAssetDepreciationLines(DEP_ACC, "1234.56");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ accountId: "exp" });
    expect(lines[1]).toMatchObject({ accountId: "accum" });
    expectBalanced(lines);
  });

  it("flips the sides for a contra release instead of posting a negative debit", () => {
    // A negative amount on a debit line still passes assertBalanced, so the
    // error would be invisible in the GL — the sides must flip instead.
    const lines = buildFixedAssetDepreciationLines(DEP_ACC, "-500");
    expect(lines[0]).toMatchObject({ accountId: "accum", debit: new D(500) });
    expect(lines[1]).toMatchObject({ accountId: "exp", credit: new D(500) });
    for (const l of lines) {
      expect(Number(l.debit ?? 0)).toBeGreaterThanOrEqual(0);
      expect(Number(l.credit ?? 0)).toBeGreaterThanOrEqual(0);
    }
    expectBalanced(lines);
  });

  it("emits no lines for a zero charge", () => {
    expect(buildFixedAssetDepreciationLines(DEP_ACC, 0)).toEqual([]);
  });
});

describe("disposal posting lines", () => {
  // PRD worked example 3: 3 of 8 office chairs disposed 2026-12-31 for 3,000,
  // producing a loss of 1,850.54.
  const CHAIRS = {
    purchasePrice: 20859.84,
    quantity: 8,
    startDate: d("2025-02-06"),
    usefulLifeMonths: 60,
  };
  const result = computeDisposal(CHAIRS, {
    unitsDisposed: 3,
    disposalDate: d("2026-12-31"),
    proceeds: 3000,
  });

  it("balances on the PRD worked example", () => {
    const lines = buildFixedAssetDisposalLines(DISP_ACC, {
      costRemoved: result.costRemoved,
      accumulatedRemoved: result.accumulatedRemoved,
      proceeds: 3000,
      gainLoss: result.gainLoss,
    });
    expectBalanced(lines);
  });

  it("books a loss as a DEBIT to the loss account", () => {
    const lines = buildFixedAssetDisposalLines(DISP_ACC, {
      costRemoved: result.costRemoved,
      accumulatedRemoved: result.accumulatedRemoved,
      proceeds: 3000,
      gainLoss: result.gainLoss,
    });
    const loss = lines.find((l) => l.accountId === "loss");
    expect(loss?.debit).toBeDefined();
    expect(new D(loss!.debit!).toFixed(2)).toBe("1850.54");
    expect(lines.find((l) => l.accountId === "gain")).toBeUndefined();
  });

  it("books a gain as a CREDIT to the gain account", () => {
    const lines = buildFixedAssetDisposalLines(DISP_ACC, {
      costRemoved: "1000",
      accumulatedRemoved: "800",
      proceeds: "500",
      gainLoss: "300",
    });
    const gain = lines.find((l) => l.accountId === "gain");
    expect(new D(gain!.credit!).toFixed(2)).toBe("300.00");
    expect(lines.find((l) => l.accountId === "loss")).toBeUndefined();
    expectBalanced(lines);
  });

  it("omits the proceeds line for a write-off and still balances", () => {
    // Full write-off: no cash, the whole remaining NBV is the loss.
    const lines = buildFixedAssetDisposalLines(DISP_ACC, {
      costRemoved: "5000",
      accumulatedRemoved: "2000",
      proceeds: 0,
      gainLoss: "-3000",
    });
    expect(lines.find((l) => l.accountId === "clearing")).toBeUndefined();
    expectBalanced(lines);
  });

  it("handles a disposal at exactly book value (no gain, no loss)", () => {
    const lines = buildFixedAssetDisposalLines(DISP_ACC, {
      costRemoved: "5000",
      accumulatedRemoved: "2000",
      proceeds: "3000",
      gainLoss: 0,
    });
    expect(lines.find((l) => l.accountId === "gain")).toBeUndefined();
    expect(lines.find((l) => l.accountId === "loss")).toBeUndefined();
    expectBalanced(lines);
  });
});

// The `post` flag is the only thing standing between a preview and an
// irreversible journal entry, so its parsing is guarded here rather than left to
// the route. z.coerce.boolean() is Boolean(input), which turns "false" into TRUE
// — these cases exist to keep anyone from reintroducing it.
describe("depreciation run `post` flag parsing", () => {
  const base = { entityId: "e1", year: 2026, month: 8 };
  const parse = (post?: unknown) =>
    fixedAssetDepreciationRunSchema.parse(
      post === undefined ? base : { ...base, post },
    ).post;

  it("defaults to preview when the flag is omitted", () => {
    expect(parse()).toBe(false);
  });

  it("accepts a real JSON boolean from the POST body", () => {
    expect(parse(true)).toBe(true);
    expect(parse(false)).toBe(false);
  });

  it('treats the STRING "false" as false, not as a post', () => {
    expect(parse("false")).toBe(false);
    expect(parse("true")).toBe(true);
  });

  it("rejects anything else rather than guessing toward posting", () => {
    for (const bad of ["0", "no", "yes", 1, {}]) {
      expect(() => parse(bad)).toThrow();
    }
  });
});
