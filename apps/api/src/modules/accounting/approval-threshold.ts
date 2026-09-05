// Second-level approval: when a document is large enough to need two people,
// and when a set of small documents looks like one large one cut up.
//
// Pure + DB-free. No accounting entries come out of this — it is an internal
// control — but it decides whether a document posts, so the rules are tested in
// isolation rather than only through the write paths.

import { roundMoney } from "@/modules/accounting/rounding";

export type ApprovalDocType = "invoice" | "bill" | "journal";

export interface SecondApprovalConfig {
  /** Off by default. A single-accountant team has nobody to be the second
   *  approver, and turning it on then would just stop work. */
  enabled: boolean;
  /** Per document type, in base currency. A missing or null threshold means
   *  that type never needs a second approver, even while the feature is on. */
  thresholds: Partial<Record<ApprovalDocType, number | null>>;
  /** Days a document may sit waiting before it shows up as overdue. */
  staleDays: number;
}

export const DEFAULT_SECOND_APPROVAL: SecondApprovalConfig = {
  enabled: false,
  // The PRD's recommended starting point. Only takes effect once someone
  // switches the feature on.
  thresholds: { invoice: 100000, bill: 100000, journal: 100000 },
  staleDays: 7,
};

/**
 * Does this document need a second approver?
 *
 * Compared on the document TOTAL INCLUDING VAT, converted to base currency,
 * because that is the cash that will actually move — which is the exposure the
 * control exists to cover. Comparing ex-VAT would let a document worth more
 * than the threshold through on a technicality.
 *
 * `>=` not `>`: a threshold of 100,000 means a document of exactly 100,000
 * needs two people. Anything else makes the round number the one value that
 * slips past.
 */
export function requiresSecondApproval(opts: {
  config: SecondApprovalConfig;
  docType: ApprovalDocType;
  /** Grand total incl. VAT, already converted to base currency. */
  baseTotal: number;
}): boolean {
  if (!opts.config.enabled) return false;
  const threshold = opts.config.thresholds[opts.docType];
  if (threshold == null) return false;
  return roundMoney(opts.baseTotal) >= roundMoney(threshold);
}

export interface SplitCandidate {
  id: string;
  /** Grand total incl. VAT in base currency. */
  baseTotal: number;
}

export interface SplitFinding {
  suspected: boolean;
  combinedTotal: number;
  documentIds: string[];
  threshold: number;
}

/**
 * Do these documents look like one large document cut into small ones?
 *
 * The caller supplies the documents that share a counterparty, a type and a
 * date. Splitting is suspected when they add up to the threshold while every
 * one of them individually stays under it — that shape is what evades a
 * per-document control, and it is the only shape worth flagging: if one of them
 * already exceeds the threshold, the control has caught it anyway.
 *
 * This WARNS and records. It does not block, because legitimately issuing two
 * invoices to one customer on one day is ordinary, and a control that stops
 * ordinary work gets switched off.
 */
export function detectSplitDocuments(opts: {
  documents: SplitCandidate[];
  threshold: number | null | undefined;
}): SplitFinding {
  const threshold = opts.threshold;
  const empty: SplitFinding = {
    suspected: false,
    combinedTotal: 0,
    documentIds: [],
    threshold: threshold ?? 0,
  };
  if (threshold == null || opts.documents.length < 2) return empty;

  const combined = roundMoney(
    opts.documents.reduce((sum, d) => sum + d.baseTotal, 0),
  );
  const everyOneBelow = opts.documents.every(
    (d) => roundMoney(d.baseTotal) < roundMoney(threshold),
  );
  if (!everyOneBelow || combined < roundMoney(threshold)) return empty;

  return {
    suspected: true,
    combinedTotal: combined,
    documentIds: opts.documents.map((d) => d.id),
    threshold,
  };
}

/**
 * May this person give the second approval?
 *
 * Being a different person from the first approver is IDENTITY, not permission.
 * Two approvers both holding `accounting:approve` is what makes them eligible;
 * being someone else is what makes the second signature worth anything. A
 * permission check cannot express that, so it lives here.
 */
export function canGiveSecondApproval(opts: {
  firstApproverId: string | null;
  actorId: string;
}): boolean {
  return Boolean(opts.firstApproverId) && opts.firstApproverId !== opts.actorId;
}
