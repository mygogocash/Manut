import * as XLSX from "xlsx";
import {
  EQUITY_MONTHLY_SHEET_HINT,
  parseEquitySalaryWorkbook,
} from "./equity-salary-import.js";

export function parseEquitySalaryImportBuffer(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  if (wb.SheetNames.length === 0) {
    throw new Error("Workbook has no sheets");
  }
  const sheetName =
    wb.SheetNames.find((n) =>
      n.toLowerCase().includes(EQUITY_MONTHLY_SHEET_HINT.toLowerCase()),
    ) ?? wb.SheetNames[0]!;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
    header: 1,
    defval: "",
    raw: true,
  });
  return parseEquitySalaryWorkbook(aoa);
}
