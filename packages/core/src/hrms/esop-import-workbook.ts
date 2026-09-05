import * as XLSX from "xlsx";
import {
  detectEsopTemplateVersion,
  ESOP_IMPORT_SHEET,
  ESOP_IMPORT_SHEET_V1,
  type ParsedRow,
  parseV1Workbook,
  parseWorkbookRow,
} from "./esop-import.js";

export type EsopImportParseResult = {
  parsedRows: ParsedRow[];
  parseErrors: { rowNumber: number; errors: string[] }[];
};

export function buildEsopImportTemplate(format: "xlsx" | "csv" = "xlsx"): {
  body: Uint8Array | string;
  contentType: string;
  filename: string;
} {
  const headerRow = [
    "Name of Staff",
    "Equity Type",
    "Equity in USD",
    "Equity in THB",
    "No. of Shares",
    "Lock Period",
    "Vesting Period",
    "Increasing Period",
    "Source / Notes",
  ];
  const equityTypes = [
    "Equity from Contract",
    "Sign-up Equity",
    "CXO Equity",
    "Equity from 2024 Bonus",
    "Golden Handcuff",
  ];
  const personBlock = (
    name: string,
    position: string,
    header: string,
    rows: Array<Partial<Record<(typeof headerRow)[number], string | number>>>,
  ): unknown[][] => {
    const block: unknown[][] = [
      [`${name}  —  ${position}${header ? `   |   ${header}` : ""}`],
    ];
    for (const type of equityTypes) {
      const r = rows.find((x) => x["Equity Type"] === type) ?? {
        "Equity Type": type,
      };
      block.push([
        name,
        r["Equity Type"] ?? type,
        r["Equity in USD"] ?? "",
        r["Equity in THB"] ?? "",
        r["No. of Shares"] ?? "",
        r["Lock Period"] ?? "",
        r["Vesting Period"] ?? "",
        r["Increasing Period"] ?? "",
        r["Source / Notes"] ?? "",
      ]);
    }
    block.push([`Total — ${name}`]);
    block.push([]);
    return block;
  };

  const aoa: unknown[][] = [
    ["Binary Holdings — Equity Summary Report (Revised)"],
    [
      "Assumptions:",
      "USD/THB FX Rate",
      36.5,
      "Share Price (USD)",
      1,
      "Report Date",
      "",
      "Source",
      "Employment Contracts + Annual Review",
    ],
    [],
    headerRow,
    ["CEO Office"],
    ...personBlock(
      "Jane Doe",
      "Chief Example Officer",
      "BNRY Tokens (Contract): THB 280,000   |   Shark Tank Bonus: 50,000 Tokens",
      [
        {
          "Equity Type": "Equity from Contract",
          "Equity in THB": "280000/month",
        },
        { "Equity Type": "Sign-up Equity", "Equity in USD": 500000 },
        { "Equity Type": "CXO Equity", "No. of Shares": 50000 },
        { "Equity Type": "Golden Handcuff", "No. of Shares": 20000 },
      ],
    ),
    ["Marketing Team"],
    ...personBlock(
      "John Smith",
      "Digital Marketing Manager",
      "BNRY Tokens (Contract): N/A",
      [{ "Equity Type": "Golden Handcuff", "No. of Shares": 1000 }],
    ),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, ESOP_IMPORT_SHEET_V1);

  if (format === "csv") {
    return {
      body: XLSX.utils.sheet_to_csv(ws),
      contentType: "text/csv; charset=utf-8",
      filename: "esop-grants-import-template.csv",
    };
  }

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  return {
    body: buf,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "esop-grants-import-template.xlsx",
  };
}

export function parseEsopImportBuffer(buffer: ArrayBuffer): EsopImportParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  if (wb.SheetNames.length === 0) {
    throw new Error("Workbook has no sheets");
  }
  const firstSheetAoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, {
    header: 1,
    defval: "",
    raw: true,
  });
  const version = detectEsopTemplateVersion(wb.SheetNames, firstSheetAoa);

  const parsedRows: ParsedRow[] = [];
  const parseErrors: { rowNumber: number; errors: string[] }[] = [];

  if (version === "v1") {
    const sheetName =
      wb.SheetNames.find((n) => n === ESOP_IMPORT_SHEET_V1) ?? wb.SheetNames[0]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
      header: 1,
      defval: "",
      raw: true,
    });
    const result = parseV1Workbook(aoa);
    parsedRows.push(...result.rows);
    parseErrors.push(...result.parseErrors);
  } else {
    const sheetName =
      wb.SheetNames.find((n) => n === ESOP_IMPORT_SHEET) ?? wb.SheetNames[0]!;
    const sheet = wb.Sheets[sheetName]!;
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    rawRows.forEach((raw, idx) => {
      const rowNumber = idx + 2;
      const parsed = parseWorkbookRow(raw, rowNumber);
      if (!parsed) return;
      if (parsed.cellErrors.length > 0) {
        parseErrors.push({ rowNumber, errors: parsed.cellErrors });
      }
      parsedRows.push(parsed.row);
    });
  }

  return { parsedRows, parseErrors };
}
