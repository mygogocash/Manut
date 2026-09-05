import { describe, expect, it } from "vitest";

import {
  classifyInactiveReuse,
  collectCoaFieldErrors,
  duplicateCodeError,
  englishCharsetError,
  type InactiveAccountFacts,
  isBlank,
  normalizeEnglishName,
  sanitizeCoaText,
} from "@/modules/accounting/coa-validation";

describe("coa-validation", () => {
  it("treats only spaces as blank", () => {
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\n\t")).toBe(true);
    expect(isBlank("Cash")).toBe(false);
  });

  it("strips pasted line breaks and trims before comparison", () => {
    expect(sanitizeCoaText("  Cash on Hand \n")).toBe("Cash on Hand");
  });

  it("normalises English names case-insensitively and collapses spaces", () => {
    expect(normalizeEnglishName("CASH ON HAND")).toBe("cash on hand");
    expect(normalizeEnglishName("cash  on  hand")).toBe("cash on hand");
    expect(normalizeEnglishName(" cash on hand ")).toBe("cash on hand");
  });

  it("rejects English fields that contain digits, symbols, or Thai", () => {
    expect(englishCharsetError("name", "VAT Input 7%")?.message).toMatch(
      /English letters and spaces/,
    );
    expect(
      englishCharsetError("name", "Cash & Cash Equivalents"),
    ).not.toBeNull();
    expect(englishCharsetError("description", "เงินสด")).not.toBeNull();
    expect(englishCharsetError("name", "Cash and Cash Equivalents")).toBeNull();
  });

  it("requires all five fields on create", () => {
    const errors = collectCoaFieldErrors(
      { code: "1050", name: "Prepaid Rent" },
      { requireAll: true, validateEnglish: true },
    );
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(["description", "descriptionTh", "nameTh"]);
  });

  it("duplicate code message includes colliding code and name", () => {
    expect(duplicateCodeError("1010", "Cash on Hand").message).toBe(
      "Account code already in use: 1010 Cash on Hand",
    );
  });

  it("does not charset-check when validateEnglish is false (untouched existing name)", () => {
    const errors = collectCoaFieldErrors(
      { descriptionTh: "อัปเดต" },
      { requireAll: false, validateEnglish: false },
    );
    expect(errors).toEqual([]);
  });
});

const dead = (
  over: Partial<InactiveAccountFacts> = {},
): InactiveAccountFacts => ({
  matchedOn: "code",
  id: "acc-dead",
  code: "1030",
  name: "Petty Cash",
  nameTh: "เงินสดย่อย",
  deactivatedAt: new Date("2026-06-30T00:00:00.000Z"),
  balance: 0,
  lastMovementYear: 2025,
  mappedInFinancialStatements: false,
  ...over,
});

describe("classifyInactiveReuse", () => {
  it("allows a code nothing dead is sitting on", () => {
    const d = classifyInactiveReuse([], { acknowledged: false });
    expect(d.outcome).toBe("allow");
    expect(d.reusedFromAccountId).toBeNull();
  });

  it("requires an acknowledgement when the dead account is squared off", () => {
    const d = classifyInactiveReuse([dead()], { acknowledged: false });
    expect(d.outcome).toBe("acknowledge");
    expect(d.errors[0]?.field).toBe("acknowledgeInactiveReuse");
    expect(d.warnings[0]?.message).toContain("balance 0.00");
  });

  it("allows it once acknowledged, and points back at the dead account", () => {
    const d = classifyInactiveReuse([dead()], { acknowledged: true });
    expect(d.outcome).toBe("allow");
    expect(d.reusedFromAccountId).toBe("acc-dead");
  });

  it("blocks a dead account that still carries a balance", () => {
    const d = classifyInactiveReuse([dead({ balance: 4500 })], {
      acknowledged: true,
    });
    expect(d.outcome).toBe("block");
    expect(d.errors[0]?.message).toContain("still has a balance");
    expect(d.reusedFromAccountId).toBeNull();
  });

  // A credit-normal account carries a negative debit-positive balance. It is
  // just as much a collision as a positive one.
  it("blocks a credit balance too", () => {
    expect(
      classifyInactiveReuse([dead({ balance: -4500 })], { acknowledged: true })
        .outcome,
    ).toBe("block");
  });

  it("treats sub-satang dust as squared off", () => {
    expect(
      classifyInactiveReuse([dead({ balance: 0.004 })], { acknowledged: true })
        .outcome,
    ).toBe("allow");
  });

  it("blocks an account still on the financial-statement mapping at any balance", () => {
    const d = classifyInactiveReuse(
      [dead({ mappedInFinancialStatements: true })],
      { acknowledged: true },
    );
    expect(d.outcome).toBe("block");
    expect(d.errors[0]?.message).toContain(
      "mapped in the financial statements",
    );
  });

  it("reports both when the code and the name hit different dead accounts", () => {
    const d = classifyInactiveReuse(
      [dead(), dead({ matchedOn: "name", id: "acc-other", code: "1099" })],
      { acknowledged: false },
    );
    expect(d.warnings).toHaveLength(2);
    // The code match is the stronger claim, so it is the back-pointer.
    expect(d.reusedFromAccountId).toBe("acc-dead");
  });

  it("names the deactivation date and last movement year in the warning", () => {
    const [warning] = classifyInactiveReuse([dead()], {
      acknowledged: false,
    }).warnings;
    expect(warning?.message).toContain("2026-06-30");
    expect(warning?.message).toContain("last movement 2025");
    expect(warning?.detail?.accountId).toBe("acc-dead");
  });

  it("says the date is unknown rather than inventing one", () => {
    const [warning] = classifyInactiveReuse([dead({ deactivatedAt: null })], {
      acknowledged: false,
    }).warnings;
    expect(warning?.message).toContain("date unknown");
  });
});
