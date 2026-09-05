import * as XLSX from "xlsx";

/**
 * Canonical payslip-import spreadsheet template.
 *
 * Single source of truth for the blank template HR downloads, fills, and
 * re-uploads via the bulk importer. Consumed by both the Payslip
 * Management toolbar ("Template" button) and the import wizard's Step 1
 * so the two can never drift.
 *
 * Layout mirrors HR's payroll roster (21 columns, two-row header):
 *
 *   A Employee Name   B Designation   C Department   D Date of Joining
 *   E Basic Salary    F Currency      G Pay Period   H Overtime
 *   I..M Allowances band (merged I1:M1):
 *        I Meal   J Transportation   K Phone   L House   M Internet Bills
 *   N Other income   O Reimbursement
 *   P Tax   Q SSF   R Other Deduction
 *   S Total Payout INR   T Total Payout USD   U Total Payout THB
 *
 * Internet Bills sits UNDER the merged Allowances band (row 2), matching
 * HR's own sheet. The importer flattens the two-row header to `row2 ||
 * row1`, so the nested cell still resolves to the "Internet Bills" key it
 * expects — the change is purely visual.
 */
export const PAYSLIP_TEMPLATE_HEADERS_ROW1: string[] = [
  "Employee Name",
  "Designation",
  "Department",
  "Date of Joining",
  "Basic Salary",
  "Currency",
  "Pay Period",
  "Overtime",
  "Allowances",
  "",
  "",
  "",
  "", // Internet Bills lives on row 2 under the merged Allowances band.
  "Other income",
  "Reimbursement",
  "Tax",
  "SSF",
  "Other Deduction",
  "Total Payout INR",
  "Total Payout USD",
  "Total Payout THB",
];

export const PAYSLIP_TEMPLATE_HEADERS_ROW2: string[] = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "Meal Allowance",
  "Transportation Allowance",
  "Phone Allowance",
  "House Allowance",
  "Internet Bills",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];

// One worked example row so HR sees the expected date / currency format
// and how the allowance / deduction columns line up. The Total Payout
// cells are left blank on purpose — they carry live formulas (below).
//
// Columns: Name | Designation | Department | Date of Joining |
// Basic Salary | Currency | Pay Period | Overtime |
// Meal | Transportation | Phone | House | Internet Bills |
// Other income | Reimbursement | Tax | SSF | Other Deduction |
// Total Payout INR | USD | THB
export const PAYSLIP_TEMPLATE_SAMPLE_ROWS: Array<Array<string | number>> = [
  [
    "Kunanon Jarat",
    "Senior Engineer",
    "IT",
    "16-Feb-24",
    100000,
    "THB",
    "01-Jan-26",
    0,
    1500,
    1000,
    500,
    0,
    0,
    0,
    0,
    7500,
    750,
    0,
    "",
    "",
    "",
  ],
];

/**
 * Build the template worksheet: two-row header, the merged Allowances
 * band, one sample row, and per-currency Total Payout formulas.
 *
 * The three Total Payout columns (S/T/U → INR/USD/THB) are gated on the
 * row's Currency cell (column F) so only the matching one lights up,
 * keeping a mixed-currency run legible.
 */
export function buildPayslipImportTemplateSheet(): XLSX.WorkSheet {
  const data: Array<Array<string | number>> = [
    PAYSLIP_TEMPLATE_HEADERS_ROW1,
    PAYSLIP_TEMPLATE_HEADERS_ROW2,
    ...PAYSLIP_TEMPLATE_SAMPLE_ROWS,
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Header merges mirror HR's roster:
  //  - Every single-column header (A..H, N..U) spans both header rows
  //    vertically so its label sits centred across the two-row band.
  //  - The "Allowances" group header (I..M) spans horizontally over its
  //    five sub-columns (Meal / Transportation / Phone / House / Internet
  //    Bills), whose names live on row 2.
  const merges: XLSX.Range[] = [{ s: { r: 0, c: 8 }, e: { r: 0, c: 12 } }];
  const singleCols = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 16, 17, 18, 19, 20];
  for (const c of singleCols) merges.push({ s: { r: 0, c }, e: { r: 1, c } });
  ws["!merges"] = merges;

  // Net payout per row:
  //   Earnings:   E (Basic Salary) + H (Overtime) + I..M (Allowances)
  //               + N (Other income) + O (Reimbursement)
  //   Deductions: P (Tax) + Q (SSF) + R (Other Deduction)
  const total = (r: number) =>
    `E${r}+H${r}+I${r}+J${r}+K${r}+L${r}+M${r}+N${r}+O${r}-P${r}-Q${r}-R${r}`;
  for (let i = 0; i < PAYSLIP_TEMPLATE_SAMPLE_ROWS.length; i += 1) {
    const rowNo = 3 + i; // 1-indexed; header rows are 1 and 2
    // S → INR (18), T → USD (19), U → THB (20)
    const inrRef = XLSX.utils.encode_cell({ r: 1 + i + 1, c: 18 });
    ws[inrRef] = { t: "n", f: `IF(F${rowNo}="INR", ${total(rowNo)}, "")` };
    const usdRef = XLSX.utils.encode_cell({ r: 1 + i + 1, c: 19 });
    ws[usdRef] = { t: "n", f: `IF(F${rowNo}="USD", ${total(rowNo)}, "")` };
    const thbRef = XLSX.utils.encode_cell({ r: 1 + i + 1, c: 20 });
    ws[thbRef] = { t: "n", f: `IF(F${rowNo}="THB", ${total(rowNo)}, "")` };
  }

  return ws;
}

/**
 * Generate the blank payslip-import template and trigger a browser
 * download. `xlsx` keeps the merged header + live Total Payout formulas;
 * `csv` flattens to a plain grid (formulas become blanks).
 */
export function downloadPayslipImportTemplate(format: "xlsx" | "csv"): void {
  const ws = buildPayslipImportTemplateSheet();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payslips");
  XLSX.writeFile(
    wb,
    format === "xlsx"
      ? "payslip-import-template.xlsx"
      : "payslip-import-template.csv",
    format === "csv" ? { bookType: "csv" } : undefined,
  );
}
