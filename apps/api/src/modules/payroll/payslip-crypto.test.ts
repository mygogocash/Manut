import officeCrypto from "officecrypto-tool";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  encryptXlsx,
  payslipPassword,
  protectPayslip,
} from "@/modules/payroll/payslip-crypto";

describe("payslipPassword", () => {
  it("formats a date of birth as DDMMYYYY", () => {
    expect(payslipPassword(new Date(Date.UTC(1998, 9, 31)))).toBe("31101998");
  });

  it("zero-pads single-digit day and month", () => {
    expect(payslipPassword(new Date(Date.UTC(2001, 0, 5)))).toBe("05012001");
  });

  it("accepts an ISO date string", () => {
    expect(payslipPassword("1998-10-31")).toBe("31101998");
  });

  it("returns null when there is no usable date", () => {
    expect(payslipPassword(null)).toBeNull();
    expect(payslipPassword(undefined)).toBeNull();
    expect(payslipPassword("not-a-date")).toBeNull();
  });
});

function sampleWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Net Pay"], [100]]),
    "Payslip",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("encryptXlsx", () => {
  it("turns a plain workbook into a password-encrypted one", () => {
    const plain = sampleWorkbook();
    expect(officeCrypto.isEncrypted(plain)).toBe(false);

    const encrypted = encryptXlsx(plain, "31101998");
    expect(officeCrypto.isEncrypted(encrypted)).toBe(true);
  });
});

describe("protectPayslip", () => {
  it("encrypts xlsx when a password is provided", async () => {
    const { buffer, protected: isProtected } = await protectPayslip(
      sampleWorkbook(),
      "xlsx",
      "31101998",
    );
    expect(isProtected).toBe(true);
    expect(officeCrypto.isEncrypted(buffer)).toBe(true);
  });

  it("leaves the file untouched when no password (no DOB on file)", async () => {
    const plain = sampleWorkbook();
    const { buffer, protected: isProtected } = await protectPayslip(
      plain,
      "xlsx",
      null,
    );
    expect(isProtected).toBe(false);
    expect(buffer).toBe(plain);
  });
});
