import { describe, expect, it } from "vitest";

import {
  excelSerialToISO,
  findInventoryHeaderRow,
  mapCondition,
  mapInventoryCategory,
  missingRequiredFields,
  parseDayFirstDate,
  parseInventorySheet,
  parseMoney,
  parseQuantity,
  resolveInventoryColumns,
} from "@/components/office/asset-inventory-mapping";

const HEADER = [
  "Asset ID",
  "Vendor/Shop",
  "Asset Name",
  "Category",
  "Purchase Date",
  "Quantity",
  "Unit Price (THB)",
  "Total Value (THB)",
  "Condition",
  "Location / Owner",
  "Manut update",
];

/** The real sheet's title + totals block sits above the header. */
const TITLE_BLOCK = [
  ["Asset Inventory ", null, "Asset Tracking"],
  [null, null, "Organization & Personal Fixed Asset Log"],
  [null, null, "TOTAL ASSET VALUE", null, null, "TOTAL QUANTITY OF ITEMS"],
  [null, null, "$0.00", null, null, 26],
  [],
  [],
  [],
  [],
];

function row(over: Partial<Record<number, unknown>> = {}): unknown[] {
  const base: unknown[] = [
    null,
    "Index Living Mall Public Company Limited",
    "Foldable Cart",
    "Furniture",
    "20-03-2024",
    1,
    "฿459.00",
    "฿459.00",
    null,
    "Office",
    null,
  ];
  for (const [k, v] of Object.entries(over)) base[Number(k)] = v;
  return base;
}

function sheet(...dataRows: unknown[][]): unknown[][] {
  return [...TITLE_BLOCK, HEADER, ...dataRows];
}

describe("parseDayFirstDate", () => {
  it("reads DD-MM-YYYY, which plain Date() cannot", () => {
    // new Date("20-03-2024") is an Invalid Date.
    expect(parseDayFirstDate("20-03-2024")).toBe("2024-03-20");
    expect(parseDayFirstDate("26-04-2026")).toBe("2026-04-26");
    expect(parseDayFirstDate("13-01-2026")).toBe("2026-01-13");
  });

  it("reads the ambiguous row day-first, not month-first", () => {
    // THE bug this file exists for: new Date("11-09-2024") returns 9 NOVEMBER
    // under the US reading. Every other row in the sheet has day > 12, which is
    // what establishes the format, so this row is 11 September.
    expect(parseDayFirstDate("11-09-2024")).toBe("2024-09-11");
  });

  it("accepts an already-ISO value unchanged", () => {
    expect(parseDayFirstDate("2026-08-28")).toBe("2026-08-28");
  });

  it("accepts slashes and dots as separators", () => {
    expect(parseDayFirstDate("20/03/2024")).toBe("2024-03-20");
    expect(parseDayFirstDate("20.03.2024")).toBe("2024-03-20");
  });

  it("accepts an Excel serial, in UTC so it cannot shift a day", () => {
    // 45371 = 2024-03-20.
    expect(excelSerialToISO(45371)).toBe("2024-03-20");
    expect(parseDayFirstDate(45371)).toBe("2024-03-20");
    expect(parseDayFirstDate("45371")).toBe("2024-03-20");
  });

  it("accepts a real Date object", () => {
    expect(parseDayFirstDate(new Date("2024-03-20T00:00:00.000Z"))).toBe(
      "2024-03-20",
    );
  });

  it("rejects an impossible date rather than rolling it over", () => {
    // Date(2024, 1, 31) silently becomes 2 March. That must not become data.
    expect(parseDayFirstDate("31-02-2024")).toBeNull();
    expect(parseDayFirstDate("00-03-2024")).toBeNull();
    expect(parseDayFirstDate("20-13-2024")).toBeNull();
  });

  it("returns null for blanks and junk", () => {
    expect(parseDayFirstDate(null)).toBeNull();
    expect(parseDayFirstDate("")).toBeNull();
    expect(parseDayFirstDate("   ")).toBeNull();
    expect(parseDayFirstDate("sometime last year")).toBeNull();
  });
});

describe("parseMoney", () => {
  it("strips the baht symbol and digit separators", () => {
    expect(parseMoney("฿17,990.00")).toBe(17990);
    expect(parseMoney("฿459.00")).toBe(459);
    expect(parseMoney("฿355,000.00")).toBe(355000);
    expect(parseMoney("฿50,442.94")).toBe(50442.94);
  });

  it("survives a non-breaking and a thin space from a paste", () => {
    expect(parseMoney("฿ 17,990.00")).toBe(17990);
    expect(parseMoney("฿ 17 990.00")).toBe(17990);
  });

  it("takes a number through untouched", () => {
    expect(parseMoney(7289.72)).toBe(7289.72);
    expect(parseMoney(0)).toBe(0);
  });

  it("returns null rather than NaN for junk", () => {
    expect(parseMoney("n/a")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney("฿")).toBeNull();
  });
});

describe("parseQuantity", () => {
  it("accepts positive integers only", () => {
    expect(parseQuantity(2)).toBe(2);
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity(0)).toBeNull();
    expect(parseQuantity(-1)).toBeNull();
    expect(parseQuantity(1.5)).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });
});

describe("mapInventoryCategory", () => {
  it("maps Furniture to furniture", () => {
    expect(mapInventoryCategory("Furniture")).toBe("furniture");
  });

  it("puts Accessories and Electronics in other, not a wrong category", () => {
    // Roller blinds are not a computer peripheral; AV speakers are not either.
    expect(mapInventoryCategory("Accessories")).toBe("other");
    expect(mapInventoryCategory("Electronics")).toBe("other");
  });

  it("falls back to other for blank or unknown", () => {
    expect(mapInventoryCategory(null)).toBe("other");
    expect(mapInventoryCategory("Widgets")).toBe("other");
  });
});

describe("mapCondition", () => {
  it("accepts only the four known values", () => {
    expect(mapCondition("Good")).toBe("good");
    expect(mapCondition("NEW")).toBe("new");
    expect(mapCondition("pristine")).toBeNull();
    // Every row in the real sheet is blank here.
    expect(mapCondition(null)).toBeNull();
  });
});

describe("header detection", () => {
  it("finds the header below the title and totals block", () => {
    const m = sheet(row());
    expect(findInventoryHeaderRow(m)).toBe(TITLE_BLOCK.length);
  });

  it("does not mistake the totals block for a header", () => {
    expect(findInventoryHeaderRow(TITLE_BLOCK)).toBe(-1);
  });

  it("maps every column of the real header", () => {
    const cols = resolveInventoryColumns(HEADER);
    expect(cols).toEqual({
      assetCode: 0,
      supplier: 1,
      name: 2,
      category: 3,
      purchaseDate: 4,
      quantity: 5,
      unitPrice: 6,
      totalValue: 7,
      condition: 8,
      location: 9,
    });
    expect(missingRequiredFields(cols)).toEqual([]);
  });

  it("reports the required fields it could not find", () => {
    expect(
      missingRequiredFields(resolveInventoryColumns(["Qty", "Price"])),
    ).toEqual(["name", "category"]);
  });

  it("survives reordered and renamed-but-recognised columns", () => {
    const cols = resolveInventoryColumns(["Item", "Qty", "Type", "Supplier"]);
    expect(cols.name).toBe(0);
    expect(cols.quantity).toBe(1);
    expect(cols.category).toBe(2);
    expect(cols.supplier).toBe(3);
  });
});

describe("parseInventorySheet", () => {
  it("maps a row to an asset, unit price into purchaseCost", () => {
    const { rows, sheetRows } = parseInventorySheet(sheet(row()));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        type: "furniture",
        name: "Foldable Cart",
        supplier: "Index Living Mall Public Company Limited",
        purchaseDate: "2024-03-20",
        purchaseCost: 459,
        quantity: 1,
        locationDetail: "Office",
        condition: null,
      }),
    );
    // 1-based, so it matches what the user sees in Excel.
    expect(sheetRows[0]).toBe(TITLE_BLOCK.length + 2);
    // No status: the sheet has no such column, and a default would overwrite a
    // hand-set status on re-import.
    expect(rows[0]?.status).toBeUndefined();
  });

  it("carries quantity 2 as one row, so qty x unit reproduces Total Value", () => {
    const { rows, totals } = parseInventorySheet(
      sheet(
        row({
          2: "Air purifier (White Philips)",
          5: 2,
          6: "฿9,252.34",
          7: "฿18,504.68",
        }),
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe(2);
    expect(rows[0]?.purchaseCost).toBe(9252.34);
    expect(totals.units).toBe(2);
    expect(totals.value).toBe(18504.68);
  });

  it("flags a row whose own arithmetic disagrees", () => {
    const { issues } = parseInventorySheet(
      sheet(row({ 5: 2, 6: "฿100.00", 7: "฿150.00" })),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.problem).toContain("200.00");
    expect(issues[0]?.problem).toContain("150.00");
  });

  it("flags an unreadable date instead of loading the row dateless", () => {
    const { issues, rows } = parseInventorySheet(
      sheet(row({ 4: "sometime in March" })),
    );
    expect(issues[0]?.problem).toContain("Unreadable purchase date");
    // The row still loads — a missing date is recoverable, losing the row is not.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.purchaseDate).toBeNull();
  });

  it("skips the padding rows the tracker keeps below the data", () => {
    const padding = [null, null, null, "Furniture", null, null, null, "฿0.00"];
    const { rows, blankRows } = parseInventorySheet(
      sheet(row(), padding, padding, padding),
    );
    expect(rows).toHaveLength(1);
    expect(blankRows).toBe(3);
  });

  it("skips the totals footer", () => {
    const footer = ["Total", null, null, null, null, 26, null, "฿710,670.58"];
    const { rows, totals } = parseInventorySheet(sheet(row(), footer));
    expect(rows).toHaveLength(1);
    // Crucially the footer's 26 does not enter the unit count.
    expect(totals.units).toBe(1);
  });

  it("cross-foots the whole load, which is how a bad import is caught", () => {
    const { rows, totals, issues } = parseInventorySheet(
      sheet(
        row({ 2: "Marble Table", 6: "฿17,990.00", 7: "฿17,990.00" }),
        row({ 2: "Tsubaki Tree", 6: "฿47,000.00", 7: "฿47,000.00" }),
        row({ 2: "Mable Tree", 5: 2, 6: "฿13,500.00", 7: "฿27,000.00" }),
      ),
    );
    expect(rows).toHaveLength(3);
    expect(totals.units).toBe(4);
    expect(totals.value).toBe(91990);
    expect(issues).toEqual([]);
  });

  it("returns nothing, without throwing, when there is no header", () => {
    const result = parseInventorySheet([[], ["junk"], [1, 2, 3]]);
    expect(result.headerRow).toBe(-1);
    expect(result.rows).toEqual([]);
  });

  it("keeps Thai text and embedded commas in a name intact", () => {
    const { rows } = parseInventorySheet(
      sheet(row({ 2: "ANGELO/46,โต๊ะข้างพร้อมกระจก" })),
    );
    expect(rows[0]?.name).toBe("ANGELO/46,โต๊ะข้างพร้อมกระจก");
  });
});
