import { Prisma } from "@nexora/database";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { allocateDocumentNumber } from "@/modules/accounting/numbering.service";

// The GL posting engine — the single source of truth for the general ledger.
// Every AR/AP/bank event routes through postBalancedEntry() to create a
// balanced, immediately-posted JournalEntry and move account balances, all
// inside the caller's transaction so the document and its GL posting commit or
// roll back together (NFR-2). Debit increases the stored balance (matching the
// existing accounting.repository.postJournal sign convention).

const D = Prisma.Decimal;

// ── Account mapping (the posting engine's routing table) ───────────────────

export const MAPPING_ROLES = [
  "ar_control",
  "ap_control",
  "revenue_default",
  "expense_default",
  "vat_output",
  // Situational: services / collection-basis output VAT. Unmapped entities
  // credit vat_output with a Deferred memo at issue and recognise into
  // vat_output on collection (same account, explicit audit lines).
  "vat_output_deferred",
  "vat_input",
  // Situational: AP input VAT held until the vendor tax invoice arrives.
  // Unmapped entities debit vat_input with a Deferred memo at bill send
  // and recognise into vat_input when taxInvoiceReceived flips true.
  "vat_input_deferred",
  "wht_payable",
  "wht_receivable",
  "retained_earnings",
  "rounding",
  "fx_gain",
  "fx_loss",
  "bank_charges",
  "customer_advances",
  // Situational: AP overpayment asset. customer_advances stays AR-only.
  "vendor_advances",
  // Situational: money received / paid IN ERROR, owed back in cash. Separate
  // accounts from the advance pair above because they are a different thing:
  // no VAT, and monetary under TAS 21 where an advance is not.
  "customer_overpayments_refundable",
  "vendor_overpayments_refundable",
  "sales_returns",
  // Situational: short-payment write-off (discount/expense) on collection.
  "settlement_writeoff",
  "opening_balance_equity",
  // Fixed Asset posting (Phase 2). Entity-level defaults; a FixedAssetCategory
  // may override any of them per category — see fixed-asset-accounts.ts.
  // Gain and loss are separate accounts by design: a write-off loss and a
  // disposal gain are presented and taxed differently, and one signed account
  // cannot be split apart afterwards.
  "fa_asset_cost",
  "fa_depreciation_expense",
  "fa_accumulated_depreciation",
  "fa_disposal_gain",
  "fa_disposal_loss",
] as const;

export type MappingRole = (typeof MAPPING_ROLES)[number];

// Roles that must be mapped before an entity is "ready to post". This is the
// original core set (AR/AP/revenue/expense/VAT/WHT/retained-earnings/rounding).
// The remaining roles above (fx_gain, fx_loss, bank_charges, customer_advances,
// vendor_advances, vat_output_deferred, vat_input_deferred, sales_returns,
// opening_balance_equity, and the fa_* fixed-asset set) are SITUATIONAL — they
// only apply to FX settlement, bank-charge receipts, advances, deferred VAT,
// credit-note/refund, opening balances and fixed-asset posting — so requiring
// them would flip every already-configured entity to "not ready" and stop AR/AP
// posting for entities that own no fixed assets.
// They stay fully mappable in the config UI but do not gate readiness. Which of
// these become mandatory is an open PRD decision (Section Z maker-checker /
// posting scope); revisit here if that lands.
export const REQUIRED_MAPPING_ROLES = [
  "ar_control",
  "ap_control",
  "revenue_default",
  "expense_default",
  "vat_output",
  "vat_input",
  "wht_payable",
  "wht_receivable",
  "retained_earnings",
  "rounding",
] as const satisfies readonly MappingRole[];

export class AccountMappingMissingError extends BadRequestException {
  constructor(role: string) {
    super(
      `No GL account is mapped for role "${role}". Configure it under ` +
        `Accounting → Settings → Account mapping before posting.`,
    );
  }
}

// Resolve a semantic role (e.g. "ar_control") to the concrete
// ChartOfAccount id for an entity. Throws if the mapping is unconfigured —
// posting must never silently pick a wrong account.
export async function resolveMappedAccount(
  tx: Prisma.TransactionClient,
  entityId: string,
  role: MappingRole,
): Promise<string> {
  const mapping = await tx.accountMapping.findUnique({
    where: { entityId_role: { entityId, role } },
  });
  if (!mapping) throw new AccountMappingMissingError(role);
  return mapping.chartOfAccountId;
}

export async function findMappedAccount(
  tx: Prisma.TransactionClient,
  entityId: string,
  role: MappingRole,
): Promise<string | null> {
  const mapping = await tx.accountMapping.findUnique({
    where: { entityId_role: { entityId, role } },
  });
  return mapping?.chartOfAccountId ?? null;
}

// ── Balanced-entry primitives (pure — unit-testable without a DB) ──────────

export interface PostingLine {
  accountId: string;
  debit?: number | string | Prisma.Decimal;
  credit?: number | string | Prisma.Decimal;
  memo?: string | null;
}

export interface NormalizedLine {
  accountId: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  memo: string | null;
}

// Coerce loose inputs to Decimal lines and drop fully-zero lines (a line that
// is neither a debit nor a credit carries no GL meaning).
export function normalizeLines(lines: PostingLine[]): NormalizedLine[] {
  return lines
    .map((l) => ({
      accountId: l.accountId,
      debit: new D(l.debit ?? 0),
      credit: new D(l.credit ?? 0),
      memo: l.memo ?? null,
    }))
    .filter((l) => !(l.debit.isZero() && l.credit.isZero()));
}

export function computeEntryTotals(lines: NormalizedLine[]): {
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
} {
  const totalDebit = lines.reduce((s, l) => s.plus(l.debit), new D(0));
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new D(0));
  return { totalDebit, totalCredit };
}

// The core invariant: a journal entry must have at least one non-zero line and
// Σdebit must exactly equal Σcredit. Throws BadRequestException otherwise.
export function assertBalanced(lines: NormalizedLine[]): {
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
} {
  if (lines.length === 0) {
    throw new BadRequestException("Journal entry has no non-zero lines");
  }
  const totals = computeEntryTotals(lines);
  if (!totals.totalDebit.equals(totals.totalCredit)) {
    throw new BadRequestException(
      `Unbalanced journal entry: debit ${totals.totalDebit.toFixed(2)} ` +
        `≠ credit ${totals.totalCredit.toFixed(2)}`,
    );
  }
  return totals;
}

// ── Transactional poster ───────────────────────────────────────────────────

export interface PostingRequest {
  entityId: string;
  date: Date;
  description?: string | null;
  reference?: string | null;
  // Provenance for the audit trail + report drill-through.
  sourceType: string;
  sourceRef: string;
  createdBy: string;
  lines: PostingLine[];
}

export interface PostedEntry {
  id: string;
  entryNo: string;
}

// Create a balanced, posted JournalEntry inside `tx` and move the affected
// account balances. Caller owns the transaction so this composes with the
// document write (invoice/bill/payment) into one atomic unit.
export async function postBalancedEntry(
  tx: Prisma.TransactionClient,
  req: PostingRequest,
): Promise<PostedEntry> {
  const lines = normalizeLines(req.lines);
  assertBalanced(lines);

  const entryNo = await allocateDocumentNumber(
    tx,
    req.entityId,
    "je",
    req.date,
  );
  const entry = await tx.journalEntry.create({
    data: {
      entityId: req.entityId,
      entryNo,
      date: req.date,
      description: req.description ?? null,
      reference: req.reference ?? null,
      status: "posted",
      postedAt: new Date(),
      sourceType: req.sourceType,
      sourceRef: req.sourceRef,
      createdBy: req.createdBy,
      lines: {
        createMany: {
          data: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo,
          })),
        },
      },
    },
  });

  for (const line of lines) {
    await tx.chartOfAccount.update({
      where: { id: line.accountId },
      data: { balance: { increment: line.debit.minus(line.credit) } },
    });
  }

  return { id: entry.id, entryNo };
}
