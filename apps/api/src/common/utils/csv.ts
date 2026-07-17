// Spreadsheet formula-injection guard: a *string* cell that opens with one
// of these is treated as a formula by Excel/Sheets. Prefixing a single quote
// neutralizes it. Only string values are touched, so numeric/date cells (and
// legitimate negative numbers) pass through unchanged.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: unknown): unknown {
  if (typeof value === "string" && FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Escape a single CSV field (RFC-style), guarding against formula injection. */
export function csvCell(value: unknown): string {
  const guarded = neutralizeFormula(value);
  const str = guarded == null ? "" : String(guarded);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}
