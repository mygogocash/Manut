import { describe, expect, it } from "vitest";

import {
  isBranchMismatch,
  isIncompatibleBusinessType,
  scoreContactIdentity,
} from "@/modules/accounting/contact-identity";

describe("scoreContactIdentity", () => {
  // PRD 9.5 example 1: same name, same phone — enough to open the merge screen.
  it("scores a name and phone match as sufficient", () => {
    const result = scoreContactIdentity(
      { name: "นายสมชาย รับเหมา", phone: "08x-xxx-1234" },
      { name: "นายสมชาย รับเหมา", mobile: "08xxxx1234" },
    );
    expect(result.score).toBe(2);
    expect(result.sufficient).toBe(true);
  });

  // PRD 9.5 example 2: similar name only — blocked, because one identifier
  // agreeing is a coincidence, not corroboration.
  it("blocks when only the name matches", () => {
    const result = scoreContactIdentity(
      { name: "Somchai Construction", phone: "0811111111", zipCode: "10110" },
      { name: "Somchai Construction", phone: "0822222222", zipCode: "50200" },
    );
    expect(result.score).toBe(1);
    expect(result.sufficient).toBe(false);
  });

  // The trap: two contacts with nothing recorded would otherwise score 3/3 on
  // mutual emptiness and merge anything into anything.
  it("does not count two blanks as agreement", () => {
    const result = scoreContactIdentity({}, {});
    expect(result.score).toBe(0);
    expect(result.sufficient).toBe(false);
  });

  it("sees through punctuation and spacing in names", () => {
    expect(
      scoreContactIdentity(
        { name: "บ.เอบีซี จำกัด", zipCode: "10110" },
        { name: "บ. เอบีซี  จำกัด", zipCode: "10110" },
      ).sufficient,
    ).toBe(true);
  });

  it("explains each component so the screen can show why", () => {
    const result = scoreContactIdentity(
      { name: "A", phone: "0811111111" },
      { name: "B", phone: "0811111111" },
    );
    expect(result.matches.find((m) => m.component === "name")?.detail).toMatch(
      /differ/,
    );
    expect(
      result.matches.find((m) => m.component === "contact")?.detail,
    ).toMatch(/matches/);
  });
});

describe("isIncompatibleBusinessType", () => {
  it("refuses an individual and a juristic person", () => {
    expect(isIncompatibleBusinessType("Individual", "Corporation")).toBe(true);
    expect(isIncompatibleBusinessType("บุคคลธรรมดา", "Corporation")).toBe(true);
  });

  it("allows two of the same, and stays quiet when unknown", () => {
    expect(isIncompatibleBusinessType("Corporation", "Corporation")).toBe(
      false,
    );
    expect(isIncompatibleBusinessType(null, "Corporation")).toBe(false);
  });
});

describe("isBranchMismatch", () => {
  // A tax invoice has to name the branch, so same tax ID is not enough.
  it("refuses head office merged with a branch", () => {
    expect(isBranchMismatch("00000", "00001")).toBe(true);
  });

  it("treats a blank branch as head office", () => {
    expect(isBranchMismatch(null, "00000")).toBe(false);
    expect(isBranchMismatch(null, null)).toBe(false);
    expect(isBranchMismatch(null, "00002")).toBe(true);
  });
});
