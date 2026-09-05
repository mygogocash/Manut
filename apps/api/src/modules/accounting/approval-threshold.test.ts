import { describe, expect, it } from "vitest";

import {
  canGiveSecondApproval,
  DEFAULT_SECOND_APPROVAL,
  detectSplitDocuments,
  requiresSecondApproval,
  type SecondApprovalConfig,
} from "@/modules/accounting/approval-threshold";

const on: SecondApprovalConfig = {
  enabled: true,
  thresholds: { invoice: 100000, bill: 100000, journal: 100000 },
  staleDays: 7,
};

describe("requiresSecondApproval", () => {
  // The current team is one accountant, so the feature ships off.
  it("is inert while disabled, whatever the amount", () => {
    expect(
      requiresSecondApproval({
        config: DEFAULT_SECOND_APPROVAL,
        docType: "invoice",
        baseTotal: 141191,
      }),
    ).toBe(false);
  });

  it("catches the PRD's 141,191.00 invoice and lets the 64,200.00 bill through", () => {
    expect(
      requiresSecondApproval({
        config: on,
        docType: "invoice",
        baseTotal: 141191,
      }),
    ).toBe(true);
    expect(
      requiresSecondApproval({ config: on, docType: "bill", baseTotal: 64200 }),
    ).toBe(false);
  });

  // USD 3,000 at 34.85 = 104,550 THB. One threshold, every currency.
  it("compares the base-currency total, so a foreign invoice is caught", () => {
    expect(
      requiresSecondApproval({
        config: on,
        docType: "invoice",
        baseTotal: 104550,
      }),
    ).toBe(true);
  });

  // Otherwise the round number is the single value that evades the control.
  it("treats a document exactly at the threshold as needing two people", () => {
    expect(
      requiresSecondApproval({
        config: on,
        docType: "invoice",
        baseTotal: 100000,
      }),
    ).toBe(true);
  });

  it("exempts a document type with no threshold set", () => {
    expect(
      requiresSecondApproval({
        config: { ...on, thresholds: { invoice: null } },
        docType: "invoice",
        baseTotal: 999999,
      }),
    ).toBe(false);
  });
});

describe("detectSplitDocuments", () => {
  // PRD example 3: 60,000 + 55,000 on one day, neither alone reaching 100,000.
  it("flags two same-day bills that clear the threshold together", () => {
    const finding = detectSplitDocuments({
      documents: [
        { id: "b1", baseTotal: 60000 },
        { id: "b2", baseTotal: 55000 },
      ],
      threshold: 100000,
    });
    expect(finding.suspected).toBe(true);
    expect(finding.combinedTotal).toBe(115000);
    expect(finding.documentIds).toEqual(["b1", "b2"]);
  });

  // Nothing evaded anything — the big one is already caught on its own.
  it("stays quiet when one document already exceeds the threshold", () => {
    expect(
      detectSplitDocuments({
        documents: [
          { id: "b1", baseTotal: 120000 },
          { id: "b2", baseTotal: 5000 },
        ],
        threshold: 100000,
      }).suspected,
    ).toBe(false);
  });

  it("stays quiet when the combined total is still under", () => {
    expect(
      detectSplitDocuments({
        documents: [
          { id: "b1", baseTotal: 30000 },
          { id: "b2", baseTotal: 20000 },
        ],
        threshold: 100000,
      }).suspected,
    ).toBe(false);
  });

  it("needs at least two documents, and no threshold means no finding", () => {
    expect(
      detectSplitDocuments({
        documents: [{ id: "b1", baseTotal: 500000 }],
        threshold: 100000,
      }).suspected,
    ).toBe(false);
    expect(
      detectSplitDocuments({
        documents: [
          { id: "b1", baseTotal: 60000 },
          { id: "b2", baseTotal: 55000 },
        ],
        threshold: null,
      }).suspected,
    ).toBe(false);
  });
});

describe("canGiveSecondApproval", () => {
  // Identity, not permission: the second signature is worth something only
  // because it belongs to somebody else.
  it("refuses the first approver signing again", () => {
    expect(
      canGiveSecondApproval({ firstApproverId: "u1", actorId: "u1" }),
    ).toBe(false);
    expect(
      canGiveSecondApproval({ firstApproverId: "u1", actorId: "u2" }),
    ).toBe(true);
  });

  it("refuses a second approval before a first one exists", () => {
    expect(
      canGiveSecondApproval({ firstApproverId: null, actorId: "u2" }),
    ).toBe(false);
  });
});
