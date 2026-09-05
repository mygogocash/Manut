const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: unknown): unknown {
  if (typeof value === "string" && FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Escape a cell for RFC-ish CSV (quotes when needed). */
function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  return lines.join("\n") + "\n";
}
