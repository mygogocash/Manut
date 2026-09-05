import { describe, expect, it } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { scoreContactIdentity } from "@/modules/accounting/contact-identity";
import {
  applyVendorKeepFields,
  assertContactMergeAllowed,
  assertMergeOutstandingUnchanged,
  assertVendorTaxIdMergeAllowed,
  groupVendorDuplicateSuggestions,
  scanDuplicatePaymentsAfterMerge,
} from "@/modules/accounting/vendor-merge";

describe("assertMergeOutstandingUnchanged", () => {
  it("passes when pre/post outstanding match", () => {
    expect(() => assertMergeOutstandingUnchanged(1500.5, 1500.5)).not.toThrow();
  });

  it("throws when outstanding drifts so the merge must roll back", () => {
    expect(() => assertMergeOutstandingUnchanged(1500, 1499)).toThrow(
      BadRequestException,
    );
  });

  it("names the control account that drifted", () => {
    expect(() =>
      assertMergeOutstandingUnchanged(165000, 120000, "receivable"),
    ).toThrow(/receivable outstanding/);
  });
});

describe("assertVendorTaxIdMergeAllowed", () => {
  it("blocks differing tax IDs without a reason", () => {
    expect(() =>
      assertVendorTaxIdMergeAllowed({
        survivingTaxId: "111",
        sourceTaxId: "222",
      }),
    ).toThrow(BadRequestException);
  });

  it("allows a missing tax ID with a reason", () => {
    expect(
      assertVendorTaxIdMergeAllowed({
        survivingTaxId: "111",
        sourceTaxId: "",
        missingTaxIdReason: "sole proprietor no VAT",
      }).warning,
    ).toMatch(/missing tax ID/);
  });

  // Two different tax IDs are two different legal entities. A reason used to be
  // an escape hatch here, which let a merge pool two payees' balances and their
  // withholding-tax history irreversibly.
  it("blocks differing tax IDs even when a reason is supplied", () => {
    expect(() =>
      assertVendorTaxIdMergeAllowed({
        survivingTaxId: "0105551000111",
        sourceTaxId: "0105551000222",
        missingTaxIdReason: "same owner, please merge",
      }),
    ).toThrow(/different legal entities/);
  });

  it("allows a merge when both tax IDs agree", () => {
    expect(
      assertVendorTaxIdMergeAllowed({
        survivingTaxId: "0105551000111",
        sourceTaxId: " 0105551000111 ",
      }),
    ).toEqual({});
  });

  it("blocks a missing tax ID with no reason", () => {
    expect(() =>
      assertVendorTaxIdMergeAllowed({ survivingTaxId: "111", sourceTaxId: "" }),
    ).toThrow(BadRequestException);
  });
});

describe("applyVendorKeepFields", () => {
  it("copies only fields marked source onto the survivor", () => {
    const patch = applyVendorKeepFields(
      { name: "A Co", email: "a@x.com", taxId: "111" },
      { name: "A Company", email: "b@x.com", taxId: "111" },
      { name: "source", email: "surviving" },
    );
    expect(patch).toEqual({ name: "A Company" });
  });
});

describe("groupVendorDuplicateSuggestions", () => {
  it("groups the same tax ID and empty-tax-ID name matches", () => {
    const groups = groupVendorDuplicateSuggestions([
      { id: "1", name: "Acme", taxId: "123" },
      { id: "2", name: "ACME Ltd", taxId: "123" },
      { id: "3", name: "Solo", taxId: null },
      { id: "4", name: "Solo", taxId: "  " },
      { id: "5", name: "Unique", taxId: null },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.map((v) => v.id).sort()).toEqual(["1", "2"]);
    expect(groups[1]?.map((v) => v.id).sort()).toEqual(["3", "4"]);
  });
});

describe("scanDuplicatePaymentsAfterMerge", () => {
  it("flags same-date same-amount and same-reference payments", () => {
    const groups = scanDuplicatePaymentsAfterMerge([
      {
        id: "p1",
        date: "2026-08-01",
        amount: 100,
        reference: "TX-1",
        invoiceNo: "EXP1",
      },
      {
        id: "p2",
        date: "2026-08-02",
        amount: 50,
        reference: "TX-1",
        invoiceNo: "EXP2",
      },
      {
        id: "p3",
        date: "2026-08-03",
        amount: 10,
        reference: null,
        invoiceNo: "EXP3",
      },
      {
        id: "p4",
        date: "2026-08-03",
        amount: 10,
        reference: null,
        invoiceNo: "EXP4",
      },
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("assertContactMergeAllowed", () => {
  const strongIdentity = scoreContactIdentity(
    { name: "Somchai", phone: "0811111111" },
    { name: "Somchai", mobile: "0811111111" },
  );
  const weakIdentity = scoreContactIdentity(
    { name: "Somchai", phone: "0811111111" },
    { name: "Somchai", phone: "0899999999" },
  );

  it("allows two matching tax IDs at the same branch", () => {
    expect(
      assertContactMergeAllowed({
        survivingTaxId: "0105551000111",
        sourceTaxId: "0105551000111",
        identity: weakIdentity,
      }).mergedWithoutTaxId,
    ).toBe(false);
  });

  // A tax invoice must name the branch, so same juristic person is not enough.
  it("blocks head office merged into a branch", () => {
    expect(() =>
      assertContactMergeAllowed({
        survivingTaxId: "0105551000111",
        sourceTaxId: "0105551000111",
        survivingBranchCode: "00000",
        sourceBranchCode: "00001",
        identity: strongIdentity,
      }),
    ).toThrow(/branch/);
  });

  it("blocks an individual merged with a juristic person outright", () => {
    expect(() =>
      assertContactMergeAllowed({
        survivingTaxId: "0105551000111",
        sourceTaxId: "0105551000111",
        survivingBusinessType: "Individual",
        sourceBusinessType: "Corporation",
        identity: strongIdentity,
      }),
    ).toThrow(/individual/);
  });

  it("blocks a missing tax ID when too few identifiers agree", () => {
    expect(() =>
      assertContactMergeAllowed({
        survivingTaxId: "0105551000111",
        sourceTaxId: "",
        identity: weakIdentity,
        missingTaxIdReason: "same person",
        acknowledgedSameParty: true,
      }),
    ).toThrow(/identifiers must agree/);
  });

  it("still demands a reason and an acknowledgement once identity is enough", () => {
    expect(() =>
      assertContactMergeAllowed({
        survivingTaxId: "",
        sourceTaxId: "",
        identity: strongIdentity,
      }),
    ).toThrow(/reason/);
    expect(() =>
      assertContactMergeAllowed({
        survivingTaxId: "",
        sourceTaxId: "",
        identity: strongIdentity,
        missingTaxIdReason: "sole proprietor",
      }),
    ).toThrow(/same party/);
  });

  it("labels a merge done without a tax ID so it can be sampled later", () => {
    const result = assertContactMergeAllowed({
      survivingTaxId: "",
      sourceTaxId: "",
      identity: strongIdentity,
      missingTaxIdReason: "sole proprietor, no VAT registration",
      acknowledgedSameParty: true,
    });
    expect(result.mergedWithoutTaxId).toBe(true);
    expect(result.warning).toMatch(/without a tax ID/);
  });
});
