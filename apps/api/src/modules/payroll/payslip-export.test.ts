import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { payrollRepository } from "@/modules/payroll/payroll.repository";
import { payrollService } from "@/modules/payroll/payroll.service";

vi.mock("@/modules/payroll/payroll.repository", () => ({
  payrollRepository: {
    findPayslipsForHr: vi.fn(),
  },
}));

const repo = payrollRepository as unknown as {
  findPayslipsForHr: ReturnType<typeof vi.fn>;
};

// One payslip whose stored allowances only keep the individually-persisted
// leaf keys; House/Overtime (2000 here) are folded into the total, so the
// export must surface them via the flat "Allowances" remainder.
function sampleSlip() {
  return {
    id: "p1",
    baseSalary: 100000,
    grossPay: 105000, // base + 3000 named allowances + 2000 unstored
    netPay: 96750, // gross - (ssf 750 + otherDeduction 0 + deduction 0) - tax 7500
    netPayBase: 96750,
    currency: "THB",
    documentUrl: null,
    positionSnapshot: "Senior Engineer",
    departmentSnapshot: "IT",
    startDateSnapshot: "16-Feb-24",
    allowances: {
      meal: 1500,
      transportation: 1000,
      telephone: 500,
      total: 3000,
    },
    deductions: { tax: 7500, ssf: 750, total: 8250 },
    employee: {
      id: "u1",
      name: "Kunanon Jarat",
      email: "k@x.co",
      department: "IT",
    },
    payrollRun: {
      id: "r1",
      period: "2026-07",
      status: "approved",
      entity: { id: "e1", name: "TBH Thailand" },
    },
  };
}

const NOW = new Date("2026-07-24T00:00:00Z");

function xlsxRows(buffer: Buffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
}

describe("PayrollService.exportPayslips", () => {
  beforeEach(() => repo.findPayslipsForHr.mockReset());

  it("emits xlsx with the full breakdown + round-trippable totals", async () => {
    repo.findPayslipsForHr.mockResolvedValue([sampleSlip()]);
    const { buffer, filename, contentType } =
      await payrollService.exportPayslips({ period: "2026-07" }, "xlsx", NOW);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK"); // xlsx zip
    expect(filename).toBe("payslips-2026-07-2026-07-24.xlsx");
    expect(contentType).toContain("spreadsheetml");

    const rows = xlsxRows(buffer);
    const headers = rows[0] as string[];
    const data = rows[1] as unknown[];
    const col = (name: string) => data[headers.indexOf(name)];

    expect(col("Basic Salary")).toBe(100000);
    expect(col("Meal Allowance")).toBe(1500);
    expect(col("Transportation Allowance")).toBe(1000);
    expect(col("Phone Allowance")).toBe(500);
    // House / Overtime aren't persisted per-column → 0, absorbed into the flat
    // Allowances remainder so a re-import reproduces the same gross.
    expect(col("House Allowance")).toBe(0);
    expect(col("Overtime")).toBe(0);
    expect(col("Allowances")).toBe(2000);
    expect(col("Tax")).toBe(7500); // read from deductions JSON, not a column
    expect(col("SSF")).toBe(750);
    expect(col("Deductions")).toBe(0);
    expect(col("Gross Pay")).toBe(105000);
    expect(col("Net Pay")).toBe(96750);
    expect(col("PDF Attached")).toBe("No");

    // Re-import identity: sum of the import leaf columns == gross / net.
    const allowanceCols = [
      "Overtime",
      "Meal Allowance",
      "Transportation Allowance",
      "Phone Allowance",
      "House Allowance",
      "Internet Bills",
      "Other income",
      "Reimbursement",
      "Allowances",
    ];
    const allowSum = allowanceCols.reduce(
      (acc, c) => acc + Number(col(c) || 0),
      0,
    );
    expect(Number(col("Basic Salary")) + allowSum).toBe(105000);
  });

  it("emits CSV with a BOM + header row; filename says 'all' with no period", async () => {
    repo.findPayslipsForHr.mockResolvedValue([sampleSlip()]);
    const { buffer, filename, contentType } =
      await payrollService.exportPayslips({}, "csv", NOW);
    expect(contentType).toContain("text/csv");
    expect(filename).toBe("payslips-all-2026-07-24.csv");
    const text = buffer.toString("utf-8");
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(text).toContain("Employee Name,Employee ID,Email");
    expect(text).toContain("Kunanon Jarat");
  });

  it("returns just the header row when there are no payslips", async () => {
    repo.findPayslipsForHr.mockResolvedValue([]);
    const { buffer } = await payrollService.exportPayslips({}, "csv", NOW);
    const lines = buffer.toString("utf-8").split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Employee Name");
  });
});
