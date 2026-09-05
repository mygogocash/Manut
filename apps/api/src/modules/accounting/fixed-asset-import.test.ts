import { describe, expect, it } from "vitest";

import {
  type RawImportRow,
  validateFixedAssetImportRow,
} from "./fixed-asset-import";

const CATS = new Set(["it", "pfa", "ff"]);
const ctx = { knownCategoryCodes: CATS };

const base: RawImportRow = {
  rowNumber: 2,
  name: "MacBook",
  quantity: 1,
  categoryCode: "IT",
  purchaseDate: "2026-03-01",
  purchasePrice: 44800,
};

function ok(row: RawImportRow) {
  const r = validateFixedAssetImportRow(row, ctx);
  if (r.errors.length > 0 || !r.value) {
    throw new Error(`expected ok, got: ${r.errors.join("; ")}`);
  }
  return r.value;
}
function errs(row: RawImportRow) {
  return validateFixedAssetImportRow(row, ctx).errors;
}

describe("fixed asset import — classification", () => {
  it("post-cutover asset: opening book value stays null (opening accum 0)", () => {
    const v = ok(base);
    expect(v.openingBookValue).toBeNull();
    expect(v.openingAsOfDate).toBeNull();
    expect(v.startDate).toBe("2026-03-01"); // defaults to purchase date
  });

  it("pre-cutover asset: book value becomes the cut-over opening anchor", () => {
    const v = ok({
      ...base,
      purchaseDate: "2024-05-17",
      purchasePrice: 44800,
      bookValue: 20539,
    });
    expect(v.openingBookValue).toBe(20539);
    expect(v.openingAsOfDate).toBe("2025-12-31");
  });

  it("pre-cutover asset without a book value is rejected", () => {
    expect(errs({ ...base, purchaseDate: "2024-05-17" })).toContain(
      "Book Value is required for an asset already in service on 2025-12-31",
    );
  });

  it("post-cutover asset whose book value != price is rejected", () => {
    expect(
      errs({
        ...base,
        purchaseDate: "2026-03-01",
        purchasePrice: 100,
        bookValue: 90,
      }),
    ).toContain(
      "For an asset acquired after 2025-12-31, Book Value must equal the Purchase Price",
    );
  });
});

describe("fixed asset import — reject rules (PRD §4)", () => {
  it("rejects a zero purchase price", () => {
    expect(errs({ ...base, purchasePrice: 0 }).join()).toMatch(
      /cannot be zero/,
    );
  });
  it("rejects an unknown category (whole-file trigger)", () => {
    expect(errs({ ...base, categoryCode: "NOPE" }).join()).toMatch(
      /Unknown Asset Category/,
    );
  });
  it("rejects book value below the memo value", () => {
    expect(
      errs({ ...base, purchaseDate: "2024-01-01", bookValue: 0 }).join(),
    ).toMatch(/below the memo value/);
  });
  it("rejects book value above the purchase price", () => {
    expect(
      errs({
        ...base,
        purchaseDate: "2024-01-01",
        purchasePrice: 100,
        bookValue: 200,
      }).join(),
    ).toMatch(/cannot exceed the Purchase Price/);
  });
  it("rejects start date before purchase date", () => {
    expect(errs({ ...base, startDate: "2026-02-01" }).join()).toMatch(
      /Start Date cannot precede/,
    );
  });
  it("rejects Disposed status with no disposal date", () => {
    expect(errs({ ...base, status: "Disposed" }).join()).toMatch(
      /requires a Disposal Date/,
    );
  });
  it("rejects Active status carrying a disposal date", () => {
    expect(
      errs({ ...base, status: "Active", disposalDate: "2026-06-01" }).join(),
    ).toMatch(/cannot have a Disposal Date/);
  });
  it("accepts a negative (contra) price only with a LINK: note", () => {
    expect(
      errs({
        ...base,
        purchaseDate: "2024-01-01",
        purchasePrice: -12900,
        bookValue: -1,
      }).join(),
    ).toMatch(/needs a LINK: reference/);
    const v = ok({
      ...base,
      purchaseDate: "2024-01-01",
      purchasePrice: -12900,
      bookValue: -1,
      notes: "LINK: FA-IT-2024-005",
    });
    expect(v.linkGroup).toBe("FA-IT-2024-005");
  });
});

describe("fixed asset import — round-trip of an export taken after the cut-over", () => {
  // Regression: the export's Book Value column is the NBV at the file's own
  // "as at" date. Anchoring it at a hardcoded cut-over double-counted
  // depreciation (pre-cutover rows) and rejected the whole file (post-cutover
  // rows, where NBV < cost). Passing the file's asOf makes it exact.
  it("anchors Book Value at the file's as-at date, not the cut-over", () => {
    const v = ok({
      ...base,
      purchaseDate: "2024-05-17",
      purchasePrice: 44800,
      bookValue: 18000, // depreciated further by the export date
      status: "active",
      // file exported as at 2026-06-30
      ...({} as object),
    });
    expect(v.openingAsOfDate).toBe("2025-12-31"); // default when no asOf given

    const r = validateFixedAssetImportRow(
      {
        ...base,
        purchaseDate: "2024-05-17",
        purchasePrice: 44800,
        bookValue: 18000,
      },
      { knownCategoryCodes: CATS, asOfDate: "2026-06-30" },
    );
    expect(r.errors).toEqual([]);
    expect(r.value!.openingBookValue).toBe(18000);
    expect(r.value!.openingAsOfDate).toBe("2026-06-30");
  });

  it("a post-cut-over asset that has depreciated re-imports cleanly under its own as-at date", () => {
    // Purchased 2026-01-13, exported as at 2026-06-30 with NBV < cost. Under the
    // old fixed-cutover rule this failed "Book Value must equal Purchase Price"
    // and rejected the entire file.
    const r = validateFixedAssetImportRow(
      {
        ...base,
        purchaseDate: "2026-01-13",
        purchasePrice: 13150,
        bookValue: 12000,
      },
      { knownCategoryCodes: CATS, asOfDate: "2026-06-30" },
    );
    expect(r.errors).toEqual([]);
    expect(r.value!.openingBookValue).toBe(12000);
    expect(r.value!.openingAsOfDate).toBe("2026-06-30");
  });
});

describe("fixed asset import — status validation", () => {
  it("normalises separators + legacy spellings to the canonical status", () => {
    // "Write-off" is the sheet's spelling; canonical is written_off.
    expect(
      ok({ ...base, status: "Write-off", disposalDate: "2026-06-01" }).status,
    ).toBe("written_off");
    expect(ok({ ...base, status: "In use" }).status).toBe("active");
    expect(ok({ ...base, status: "Pending disposal" }).status).toBe(
      "pending_disposal",
    );
  });

  it("rejects a status outside the known set instead of storing it verbatim", () => {
    expect(errs({ ...base, status: "Sold-ish" }).join()).toMatch(
      /Unknown Status/,
    );
  });
});
