import { describe, expect, it } from "vitest";

import {
  detectEsopTemplateVersion,
  ESOP_IMPORT_GRANT_COLUMNS,
  parseGrantCell,
  parseMonthsText,
  parsePersonHeaderV1,
  parseV1GrantRow,
  parseV1Workbook,
  parseWorkbookRow,
} from "@/modules/hrms/esop-import";

const COL_BY_HEADER = Object.fromEntries(
  ESOP_IMPORT_GRANT_COLUMNS.map((c) => [c.header, c]),
);

describe("parseGrantCell", () => {
  it("skips N/A / Separately / blank", () => {
    const equityCol = COL_BY_HEADER["Equity (contract)"]!;
    expect(parseGrantCell("N/A", equityCol)).toBeNull();
    expect(parseGrantCell("Separately", equityCol)).toBeNull();
    expect(parseGrantCell("", equityCol)).toBeNull();
    expect(parseGrantCell(null, equityCol)).toBeNull();
  });

  it("parses 'THB 280,000' as a currency grant", () => {
    const col = COL_BY_HEADER["BNRY Tokens (contract)"]!;
    const result = parseGrantCell("THB 280,000", col);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "currency",
        grantType: "tokens",
        currencyCode: "THB",
        currencyAmount: 280000,
      }),
    );
  });

  it("parses 'USD 4,000' as a USD currency grant", () => {
    const col = COL_BY_HEADER["BNRY Tokens (contract)"]!;
    const result = parseGrantCell("USD 4,000", col);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "currency",
        currencyCode: "USD",
        currencyAmount: 4000,
      }),
    );
  });

  it("parses '50,000 Shares' as a share grant", () => {
    const col = COL_BY_HEADER["CXO Equity"]!;
    const result = parseGrantCell("50,000 Shares", col);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "shares",
        grantType: "cxo_equity",
        shares: 50000,
      }),
    );
  });

  it("accepts the singular '1,000 Share'", () => {
    const col = COL_BY_HEADER["Golden Handcuff (transfer shares)"]!;
    const result = parseGrantCell("1,000 Share", col);
    expect(result).toEqual(
      expect.objectContaining({ kind: "shares", shares: 1000 }),
    );
  });

  it("treats a bare number as percent on the Equity-% column", () => {
    const pctCol = COL_BY_HEADER["Equity % of base pay (annual review 2024)"]!;
    expect(parseGrantCell(10, pctCol)).toEqual(
      expect.objectContaining({
        kind: "percent",
        grantType: "annual_review",
        percentOfBase: 10,
      }),
    );
  });

  it("treats a bare number as shares on share-only columns", () => {
    const cxoCol = COL_BY_HEADER["CXO Equity"]!;
    expect(parseGrantCell(50000, cxoCol)).toEqual(
      expect.objectContaining({
        kind: "shares",
        grantType: "cxo_equity",
        shares: 50000,
      }),
    );
  });

  it("treats a bare number as USD on Shark Tank Winner column", () => {
    const sharkCol = COL_BY_HEADER["Shark Tank Winner"]!;
    expect(parseGrantCell(50000, sharkCol)).toEqual(
      expect.objectContaining({
        kind: "currency",
        grantType: "shark_tank",
        currencyCode: "USD",
        currencyAmount: 50000,
      }),
    );
  });

  it("rejects bare numbers on currency-only columns", () => {
    const equityCol = COL_BY_HEADER["Equity (contract)"]!;
    expect(parseGrantCell(10, equityCol)).toEqual({
      error: expect.any(String),
    });
  });

  it("rejects an out-of-range percent", () => {
    const pctCol = COL_BY_HEADER["Equity % of base pay (annual review 2024)"]!;
    expect(parseGrantCell(150, pctCol)).toEqual({ error: expect.any(String) });
  });

  it("flags an unrecognised currency code", () => {
    const col = COL_BY_HEADER["Equity (contract)"]!;
    expect(parseGrantCell("XYZ 1000", col)).toEqual({
      error: expect.any(String),
    });
  });
});

describe("parseWorkbookRow", () => {
  it("emits one grant per non-empty cell", () => {
    const parsed = parseWorkbookRow(
      {
        Team: "CEO Office",
        Name: "Shahab Ahmed",
        Position: "Chief Legal Officer",
        "BNRY Tokens (contract)": "USD 2,500",
        "Equity (contract)": "THB 87,975",
        "Sign-up Equity Bonus": "1,000 Shares",
        "CXO Equity": "50,000 Shares",
        "Equity % of base pay (annual review 2024)": "Separately",
        "Golden Handcuff (transfer shares)": "20,000 Shares",
        "Shark Tank Winner": "",
      },
      7,
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.row.employeeName).toBe("Shahab Ahmed");
    expect(parsed!.row.grants).toHaveLength(5);
    expect(parsed!.row.grants.map((g) => g.grantType)).toEqual([
      "tokens",
      "equity",
      "sign_up_bonus",
      "cxo_equity",
      "golden_handcuff",
    ]);
    expect(parsed!.cellErrors).toHaveLength(0);
  });

  it("returns null for spacer rows with no Name", () => {
    expect(
      parseWorkbookRow({ Team: "", Name: "", Position: "" }, 10),
    ).toBeNull();
  });

  it("emits cell errors but still keeps usable grants", () => {
    const parsed = parseWorkbookRow(
      {
        Team: "Marketing",
        Name: "Sakshi Dolia",
        "BNRY Tokens (contract)": "garbage",
        "Equity % of base pay (annual review 2024)": 10,
        "Golden Handcuff (transfer shares)": "1,000 Shares",
      },
      14,
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.row.grants).toHaveLength(2);
    expect(parsed!.cellErrors.length).toBeGreaterThan(0);
  });
});

describe("parsePersonHeaderV1", () => {
  it("parses name, position, BNRY Tokens and Shark Tank Bonus", () => {
    const h = parsePersonHeaderV1(
      "Manit Sachin Parikh  —  Chief Executive Officer   |   BNRY Tokens (Contract): THB 280,000   |   Shark Tank Bonus: 50,000 Tokens",
    );
    expect(h).not.toBeNull();
    expect(h!.employeeName).toBe("Manit Sachin Parikh");
    expect(h!.position).toBe("Chief Executive Officer");
    expect(h!.extras).toHaveLength(2);
    expect(h!.extras[0]).toMatchObject({
      kind: "currency",
      grantType: "tokens",
      currencyCode: "THB",
      currencyAmount: 280000,
    });
    expect(h!.extras[1]).toMatchObject({
      kind: "shares",
      grantType: "shark_tank",
      shares: 50000,
    });
  });

  it("treats bare BNRY Tokens numbers as THB by default", () => {
    const h = parsePersonHeaderV1(
      "Rahul Vijayvargiya  —  Frontend Developer   |   BNRY Tokens (Contract): 8000",
    );
    expect(h!.extras[0]).toMatchObject({
      kind: "currency",
      grantType: "tokens",
      currencyCode: "THB",
      currencyAmount: 8000,
    });
  });

  it("accepts USD / INR currency prefixes in BNRY Tokens", () => {
    const usd = parsePersonHeaderV1(
      "Bhawnish Malhotra  —  Chief Operating Officer   |   BNRY Tokens (Contract): USD 4,000",
    );
    expect(usd!.extras[0]).toMatchObject({
      currencyCode: "USD",
      currencyAmount: 4000,
    });
    const inr = parsePersonHeaderV1(
      "Vetrivelu Balasubramani  —  VP of Product   |   BNRY Tokens (Contract): INR 68,000",
    );
    expect(inr!.extras[0]).toMatchObject({
      currencyCode: "INR",
      currencyAmount: 68000,
    });
  });

  it("skips BNRY Tokens: N/A without erroring", () => {
    const h = parsePersonHeaderV1(
      "Sakshi Dolia  —  Digital Marketing Manager   |   BNRY Tokens (Contract): N/A",
    );
    expect(h).not.toBeNull();
    expect(h!.extras).toHaveLength(0);
    expect(h!.extraErrors).toHaveLength(0);
  });

  it("returns null for plain section headers (no separator)", () => {
    expect(parsePersonHeaderV1("CEO Office")).toBeNull();
    expect(parsePersonHeaderV1("Marketing Team")).toBeNull();
  });

  it("returns null for total rows", () => {
    expect(parsePersonHeaderV1("Total — Manit Sachin Parikh")).toBeNull();
  });
});

describe("parseV1GrantRow", () => {
  // Helper for clarity — column order matches V1_COL.
  const row = (
    name: string,
    type: string,
    usd: unknown = "",
    thb: unknown = "",
    shares: unknown = "",
    lock: unknown = "",
    vesting: unknown = "",
    increasing: unknown = "",
    notes: unknown = "",
  ): unknown[] => [
    name,
    type,
    usd,
    thb,
    shares,
    lock,
    vesting,
    increasing,
    notes,
  ];

  it("prefers Shares column over USD/THB", () => {
    const r = parseV1GrantRow(
      row("Shahab Ahmed", "CXO Equity", "", 1825000, 50000),
    );
    expect(r.kind).toBe("grant");
    if (r.kind === "grant") {
      expect(r.grant).toMatchObject({
        kind: "shares",
        grantType: "cxo_equity",
        shares: 50000,
      });
    }
  });

  it("falls back to USD when shares is empty", () => {
    const r = parseV1GrantRow(
      row("Bhawnish Malhotra", "Sign-up Equity", 2000000),
    );
    expect(r.kind).toBe("grant");
    if (r.kind === "grant") {
      expect(r.grant).toMatchObject({
        kind: "currency",
        grantType: "sign_up_bonus",
        currencyCode: "USD",
        currencyAmount: 2000000,
      });
    }
  });

  it("skips 'Equity from Contract' rows (out of scope for ESOP)", () => {
    // Monthly contract equity ("280000/month", "THB 87975/month") is
    // salary-style and excluded from the ESOP pool (HR decision).
    expect(
      parseV1GrantRow(
        row("Manit Sachin Parikh", "Equity from Contract", "", "280000/month"),
      ).kind,
    ).toBe("skip");
    expect(
      parseV1GrantRow(
        row("Shahab Ahmed", "Equity from Contract", "", "THB 87975/month"),
      ).kind,
    ).toBe("skip");
  });

  it("folds Lock/Vesting/Notes columns into extraNotes", () => {
    const r = parseV1GrantRow(
      row(
        "Gunaseelan S",
        "Golden Handcuff",
        "",
        0,
        1000,
        "1 Year Cliff",
        "4 Years",
        "Annual (Equal Tranches)",
        "1,000 Shares",
      ),
    );
    expect(r.kind).toBe("grant");
    if (r.kind === "grant") {
      expect(r.grant.extraNotes).toContain("Lock: 1 Year Cliff");
      expect(r.grant.extraNotes).toContain("Vesting: 4 Years");
      expect(r.grant.extraNotes).toContain(
        "Increasing: Annual (Equal Tranches)",
      );
    }
  });

  it("returns skip for blank grant rows", () => {
    const r = parseV1GrantRow(row("Sakshi Dolia", "Sign-up Equity"));
    expect(r.kind).toBe("skip");
  });

  it("returns skip for unknown Equity Type values", () => {
    const r = parseV1GrantRow(row("Anyone", "Unrecognised type", "", "", 100));
    expect(r.kind).toBe("skip");
  });

  it("maps Lock→cliff and Vesting→vesting (Increasing stays in notes)", () => {
    const r = parseV1GrantRow(
      row(
        "Siddharth Sahi",
        "CXO Equity",
        "",
        0,
        50000,
        "1 Year Cliff",
        "3 years from 1 Jan 2025",
        "6 months",
        "Vested over three years in 6 month incrementals",
      ),
    );
    expect(r.kind).toBe("grant");
    if (r.kind === "grant") {
      // Lock period is the cliff (HR decision); Vesting drives the linear
      // schedule. The "6 months" Increasing cadence is not modelled — it
      // is preserved verbatim in the notes instead of becoming the cliff.
      expect(r.grant).toMatchObject({
        kind: "shares",
        grantType: "cxo_equity",
        shares: 50000,
        lockMonths: 12,
        vestingMonths: 36,
        cliffMonths: 12,
      });
      expect(r.grant.extraNotes).toContain("Increasing: 6 months");
    }
  });

  it("falls back to the lock period for vesting when Vesting is blank", () => {
    // "2-Year Locked then all 100% vested": lock=24, no separate vesting
    // → cliff 24 / vesting 24 (0 until month 24, then full).
    const r = parseV1GrantRow(
      row("Kunanon Jarat", "Golden Handcuff", "", 0, 1000, "2 years", ""),
    );
    expect(r.kind).toBe("grant");
    if (r.kind === "grant") {
      expect(r.grant).toMatchObject({
        lockMonths: 24,
        cliffMonths: 24,
        vestingMonths: 24,
      });
    }
  });

  it("leaves period fields undefined when the cells are empty", () => {
    const r = parseV1GrantRow(
      row("Bhawnish Malhotra", "Sign-up Equity", 2000000),
    );
    expect(r.kind).toBe("grant");
    if (r.kind === "grant") {
      expect(r.grant.lockMonths).toBeUndefined();
      expect(r.grant.vestingMonths).toBeUndefined();
      expect(r.grant.cliffMonths).toBeUndefined();
    }
  });
});

describe("parseMonthsText", () => {
  it("parses years (decimal-friendly)", () => {
    expect(parseMonthsText("2 year from 1 Jun 2024")).toBe(24);
    expect(parseMonthsText("1 Years from 1 Feb 2025")).toBe(12);
    expect(parseMonthsText("4 Years")).toBe(48);
    expect(parseMonthsText("0.5 year")).toBe(6);
  });

  it("parses months", () => {
    expect(parseMonthsText("6 months")).toBe(6);
    expect(parseMonthsText("3 month")).toBe(3);
  });

  it("recognises 'Annual' and 'X-Year Cliff' synonyms", () => {
    expect(parseMonthsText("Annual (Equal Tranches)")).toBe(12);
    expect(parseMonthsText("Annual")).toBe(12);
    expect(parseMonthsText("1-Year Cliff")).toBe(12);
    expect(parseMonthsText("2 Year Cliff")).toBe(24);
  });

  it("returns null for empty / skip-like values", () => {
    expect(parseMonthsText("")).toBeNull();
    expect(parseMonthsText(null)).toBeNull();
    expect(parseMonthsText("N/A")).toBeNull();
    expect(parseMonthsText("Separately")).toBeNull();
  });
});

describe("parseV1Workbook", () => {
  function makeBook(extra: unknown[][] = []): unknown[][] {
    return [
      ["Binary Holdings — Equity Summary Report (Revised)"],
      ["Assumptions:", "USD/THB FX Rate", 36.5, "Share Price (USD)", 1],
      [],
      [
        "Name of Staff",
        "Equity Type",
        "Equity in USD",
        "Equity in THB",
        "No. of Shares",
        "Lock Period",
        "Vesting Period",
        "Increasing Period",
        "Source / Notes",
      ],
      ["CEO Office"],
      [
        "Manit Sachin Parikh  —  Chief Executive Officer   |   BNRY Tokens (Contract): THB 280,000   |   Shark Tank Bonus: 50,000 Tokens",
      ],
      ["Manit Sachin Parikh", "Equity from Contract", "", "280000/month"],
      ["Manit Sachin Parikh", "Sign-up Equity"],
      ["Manit Sachin Parikh", "CXO Equity"],
      ["Manit Sachin Parikh", "Equity from 2024 Bonus"],
      ["Manit Sachin Parikh", "Golden Handcuff"],
      ["Total — Manit Sachin Parikh"],
      [],
      ...extra,
      ["GRAND TOTAL (All Staff)"],
    ];
  }

  it("emits one ParsedRow per person with merged header + grant grants", () => {
    const { rows, parseErrors } = parseV1Workbook(makeBook());
    expect(parseErrors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.employeeName).toBe("Manit Sachin Parikh");
    expect(r.position).toBe("Chief Executive Officer");
    const grantTypes = r.grants.map((g) => g.grantType);
    // tokens + shark_tank from the header; the "Equity from Contract"
    // grant row is skipped (out of scope), so no "equity" grant.
    expect(grantTypes).toEqual(
      expect.arrayContaining(["tokens", "shark_tank"]),
    );
    expect(grantTypes).not.toContain("equity");
    expect(r.grants).toHaveLength(2);
  });

  it("maps the 11-column 'Claude V1' layout (Start Lock/Vesting Date)", () => {
    // Regression for the column-shift bug: HR inserted Start Lock Date
    // (col 6) and Start Vesting Date (col 8), pushing Vesting/Increasing/
    // Notes right. Header-driven resolution must still land each field.
    const book: unknown[][] = [
      ["Binary Holdings — Equity Summary Report (Claude V1)"],
      ["Assumptions:", "USD/THB FX Rate", 36.5, "Share Price (USD)", 1],
      [],
      [
        "Name of Staff",
        "Equity Type",
        "Equity in USD",
        "Equity in THB",
        "No. of Shares",
        "Lock Period",
        "Start Lock Date",
        "Vesting Period",
        "Start Vesting Date",
        "Increasing Period",
        "Source / Notes",
      ],
      ["CEO Office"],
      ["Siddharth Sahi  —  Chief Revenue Officer"],
      // Equity from Contract → skipped.
      [
        "Siddharth Sahi",
        "Equity from Contract",
        "",
        "182000/month",
        0,
        "",
        "",
        "2 years",
        "2024-06-01",
        "",
        "Contract equity",
      ],
      // CXO Equity: 50000 shares, vesting 3y from Jan 2025, 6-month tranches.
      [
        "Siddharth Sahi",
        "CXO Equity",
        "",
        0,
        50000,
        "",
        "",
        "3 years",
        "2025-01-01",
        "6 months",
        "Vested over three years",
      ],
      ["Total — Siddharth Sahi"],
      // Second person so this is a multi-person workbook (the real
      // Equity Summary always is) — avoids the single-person dashboard
      // override path.
      ["Kunanon Jarat  —  Engineer"],
      ["Kunanon Jarat", "Golden Handcuff", "", 0, 1000, "", "", "", "", "", ""],
      ["Total — Kunanon Jarat"],
      ["GRAND TOTAL (All Staff)"],
    ];
    const { rows, parseErrors } = parseV1Workbook(book);
    expect(parseErrors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    const grants = rows.find(
      (r) => r.employeeName === "Siddharth Sahi",
    )!.grants;
    // Contract equity skipped; only the CXO share grant remains.
    expect(grants).toHaveLength(1);
    const cxo = grants[0]!;
    expect(cxo).toMatchObject({
      kind: "shares",
      grantType: "cxo_equity",
      shares: 50000,
      vestingMonths: 36,
    });
    // Start Vesting Date (col 8) → allocation start, NOT misread as a period.
    expect(cxo.allocationStartMonth?.toISOString().slice(0, 10)).toBe(
      "2025-01-01",
    );
    // The real Increasing column (col 9) reaches the notes; no Date leaks in.
    expect(cxo.extraNotes).toContain("Increasing: 6 months");
    expect(cxo.extraNotes ?? "").not.toMatch(/GMT|Indochina|\d{2}:\d{2}:\d{2}/);
  });

  it("handles a second person right after a Total row", () => {
    const extra: unknown[][] = [
      ["Marketing Team"],
      ["John Smith  —  Marketing"],
      ["John Smith", "Golden Handcuff", "", "", 1000],
      ["Total — John Smith"],
    ];
    const { rows } = parseV1Workbook(makeBook(extra));
    expect(rows).toHaveLength(2);
    expect(rows[1]!.employeeName).toBe("John Smith");
    expect(rows[1]!.grants[0]).toMatchObject({ kind: "shares", shares: 1000 });
  });

  it("threads dashboard total-vesting overrides onto the matching grant", () => {
    const extra: unknown[][] = [
      ["Dashboard"],
      ["", "Vesting", "Share", "Start", "End", "Total Vesting to date"],
      [4, "Equity from Contract", 640, "Sep-24", "Aug-26", 240],
    ];
    const { rows, parseErrors } = parseV1Workbook(makeBook(extra));

    expect(parseErrors).toHaveLength(0);
    const grant = rows[0]!.grants.find(
      (g) => g.grantType === "equity" && g.kind === "shares",
    );

    expect(grant).toMatchObject({
      kind: "shares",
      grantType: "equity",
      shares: 640,
      vestedToDateOverride: 240,
    });
    expect(grant?.allocationStartMonth?.toISOString().slice(0, 10)).toBe(
      "2024-09-01",
    );
    expect(grant?.allocationEndMonth?.toISOString().slice(0, 10)).toBe(
      "2026-08-01",
    );
  });

  it("returns empty result when header row is missing", () => {
    const { rows } = parseV1Workbook([["unrelated"], ["data"]]);
    expect(rows).toHaveLength(0);
  });
});

describe("detectEsopTemplateVersion", () => {
  it("returns v1 when 'Equity Summary' sheet is present", () => {
    expect(
      detectEsopTemplateVersion(["Equity Summary", "Notes & Legend"], null),
    ).toBe("v1");
  });

  it("returns v0 when 'Tokens and Equity Structure' sheet is present", () => {
    expect(
      detectEsopTemplateVersion(["Tokens and Equity Structure"], null),
    ).toBe("v0");
  });

  it("sniffs the first sheet when neither canonical name matches", () => {
    expect(
      detectEsopTemplateVersion(
        ["Renamed"],
        [["unrelated"], ["Name of Staff", "Equity Type", "Equity in USD"]],
      ),
    ).toBe("v1");
  });

  it("defaults to v0 when nothing matches", () => {
    expect(detectEsopTemplateVersion(["random"], [["a", "b"]])).toBe("v0");
  });
});
