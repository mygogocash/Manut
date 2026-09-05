import { describe, expect, it } from "vitest";

import {
  findHeaderRow,
  resolveColumnMapping,
} from "@/components/accounting/fixed-asset-import-mapping";

// The exact header row our own exporter writes (fixed-asset-xlsx-generator.ts).
// Export → unedited re-import must round-trip, so this list is a contract.
const EXPORT_HEADERS = [
  "Asset Code",
  "Asset Name",
  "Asset Name (TH)",
  "Quantity/Unit",
  "Asset Category",
  "Asset Location",
  "User",
  "Supplier",
  "Serial No.",
  "Purchase Date",
  "Start Date",
  "Useful Life (months)",
  "Usage Period (days)",
  "Purchase Price",
  "Book Value",
  "Status",
  "Disposal Date",
  "Selling Price (Excluding VAT)",
  "Profit/Loss",
  "Notes",
  "Link Group",
];

describe("fixed asset import mapping — our own export round-trips", () => {
  const mapping = resolveColumnMapping(EXPORT_HEADERS);

  it("binds every field to its own column", () => {
    expect(mapping.missingRequired).toEqual([]);
    expect(mapping.missingImportant).toEqual([]);
    expect(mapping.matches.filter((m) => m.index < 0)).toEqual([]);
    const used = mapping.matches.map((m) => m.index);
    expect(new Set(used).size).toBe(used.length); // no column claimed twice
  });

  it("resolves the ambiguous pairs to the right columns", () => {
    const c = mapping.columns;
    expect(EXPORT_HEADERS[c.name]).toBe("Asset Name");
    expect(EXPORT_HEADERS[c.nameTh]).toBe("Asset Name (TH)");
    expect(EXPORT_HEADERS[c.quantity]).toBe("Quantity/Unit");
    expect(EXPORT_HEADERS[c.purchasePrice]).toBe("Purchase Price");
    expect(EXPORT_HEADERS[c.bookValue]).toBe("Book Value");
    expect(EXPORT_HEADERS[c.usefulLife]).toBe("Useful Life (months)");
    expect(EXPORT_HEADERS[c.sellingPrice]).toBe(
      "Selling Price (Excluding VAT)",
    );
  });

  it("reports the derived export-only columns as ignored", () => {
    expect(mapping.unmappedHeaders).toEqual([
      "Usage Period (days)",
      "Profit/Loss",
    ]);
  });
});

describe("fixed asset import mapping — silent mis-bind regressions", () => {
  it("does not bind Quantity to a Unit Price column", () => {
    const headers = ["Asset Name", "Unit Price", "Quantity", "Book Value"];
    const m = resolveColumnMapping(headers);
    expect(headers[m.columns.quantity]).toBe("Quantity");
    // Unit Price is a per-unit figure, not the capitalised cost — leaving it
    // unclaimed surfaces it in "Ignored columns" instead of silently loading it.
    expect(m.unmappedHeaders).toContain("Unit Price");
  });

  it("does not bind Asset Code to a Category Code column", () => {
    const headers = ["Category Code", "Asset Code", "Asset Name"];
    const m = resolveColumnMapping(headers);
    expect(headers[m.columns.assetCode]).toBe("Asset Code");
    expect(headers[m.columns.categoryCode]).toBe("Category Code");
  });

  it("does not bind Purchase Price to a Cost Center column", () => {
    const headers = ["Cost Center", "Purchase Price"];
    const m = resolveColumnMapping(headers);
    expect(headers[m.columns.purchasePrice]).toBe("Purchase Price");
  });

  it("keeps Asset Name off the Thai column even when Thai comes first", () => {
    const headers = ["Asset Name (TH)", "Asset Name", "Purchase Price"];
    const m = resolveColumnMapping(headers);
    expect(headers[m.columns.nameTh]).toBe("Asset Name (TH)");
    expect(headers[m.columns.name]).toBe("Asset Name");
    expect(m.columns.name).not.toBe(m.columns.nameTh);
  });

  it("prefers an exact header over a substring match", () => {
    const headers = ["Notes on disposal", "Notes", "Asset Name"];
    const m = resolveColumnMapping(headers);
    expect(headers[m.columns.notes]).toBe("Notes");
  });

  it("reports the field that lost a shared column instead of duplicating it", () => {
    // Only a Thai name column: `nameTh` claims it and `name` must come back
    // unmatched, never silently pointing at the same cell.
    const headers = ["Asset Name (TH)", "Purchase Price", "Book Value"];
    const m = resolveColumnMapping(headers);
    expect(m.columns.name).toBe(-1);
    expect(m.missingRequired.map((x) => x.field)).toContain("name");
  });
});

describe("fixed asset import mapping — real-sheet wording", () => {
  it("matches Thai headers", () => {
    const headers = [
      "รหัสทรัพย์สิน",
      "ชื่อทรัพย์สิน",
      "จำนวน",
      "ประเภททรัพย์สิน",
      "วันที่ซื้อ",
      "ราคาทุน",
      "มูลค่าคงเหลือ",
      "สถานะ",
    ];
    const m = resolveColumnMapping(headers);
    expect(m.missingRequired).toEqual([]);
    expect(headers[m.columns.assetCode]).toBe("รหัสทรัพย์สิน");
    expect(headers[m.columns.name]).toBe("ชื่อทรัพย์สิน");
    expect(headers[m.columns.quantity]).toBe("จำนวน");
    expect(headers[m.columns.purchasePrice]).toBe("ราคาทุน");
    expect(headers[m.columns.bookValue]).toBe("มูลค่าคงเหลือ");
  });

  it("matches alternative English wording", () => {
    const headers = [
      "Asset No.",
      "Description",
      "Qty",
      "Asset Class",
      "Acquisition Date",
      "In Service Date",
      "Acquisition Cost",
      "Net Book Value",
      "Condition",
    ];
    const m = resolveColumnMapping(headers);
    expect(m.missingRequired).toEqual([]);
    expect(headers[m.columns.assetCode]).toBe("Asset No.");
    expect(headers[m.columns.name]).toBe("Description");
    expect(headers[m.columns.startDate]).toBe("In Service Date");
    expect(headers[m.columns.purchasePrice]).toBe("Acquisition Cost");
    expect(headers[m.columns.bookValue]).toBe("Net Book Value");
  });

  it("flags a missing required column instead of erroring on every row", () => {
    const headers = ["Asset Code", "Asset Name", "Asset Category", "Cost"];
    const m = resolveColumnMapping(headers);
    expect(m.missingRequired.map((x) => x.field).sort()).toEqual([
      "bookValue",
      "purchaseDate",
    ]);
  });

  it("names the fallback for a missing important column", () => {
    const headers = [
      "Asset Name",
      "Asset Category",
      "Purchase Date",
      "Purchase Price",
      "Book Value",
    ];
    const m = resolveColumnMapping(headers);
    expect(m.missingRequired).toEqual([]);
    const quantity = m.missingImportant.find((x) => x.field === "quantity");
    expect(quantity?.fallback).toMatch(/memo value/);
  });
});

describe("fixed asset import mapping — header row detection", () => {
  it("finds the header under the report title block", () => {
    const matrix: unknown[][] = [
      ["Fixed Asset Report — as at 2025-12-31"],
      [],
      EXPORT_HEADERS,
      ["FA-IT-2025-001", "Laptop", "", 1, "IT", "HQ"],
    ];
    expect(findHeaderRow(matrix)).toBe(2);
  });

  it("finds a header that never says 'Asset Code' verbatim", () => {
    const matrix: unknown[][] = [
      ["งบทรัพย์สิน"],
      [
        "Asset No.",
        "Description",
        "Qty",
        "Asset Class",
        "Acquisition Date",
        "Acquisition Cost",
        "Net Book Value",
      ],
    ];
    expect(findHeaderRow(matrix)).toBe(1);
  });

  it("returns -1 when no row looks like a header", () => {
    const matrix: unknown[][] = [
      ["Fixed Asset Report"],
      [],
      ["FA-IT-2025-001", "Laptop", 1, 35000, 20000],
    ];
    expect(findHeaderRow(matrix)).toBe(-1);
  });
});
