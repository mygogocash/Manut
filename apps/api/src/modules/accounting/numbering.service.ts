import { type Prisma } from "@nexora/database";

import { BadRequestException } from "@/common/exceptions/http-exception";

// Race-safe per-entity, per-document-type running numbers. Replaces the
// client-supplied invoiceNo and the count-based (race-prone) generateEntryNo,
// which has been removed — manual journals and the posting engine now share
// this one allocator, so they can no longer issue the same number from two
// independent counters.
// The number is allocated inside the caller's transaction so it commits or
// rolls back atomically with the document it numbers.
//
// 18 Aug 2026 PRD overlay: statutory types (je / invoice / receipt / bill)
// issue prefix+YYYYMM+3-digit monthly numbers from the **document date**,
// cap at 999/month, and never reuse a cancelled number (the counter only
// increments). Drafts use a separate never-reset series that does not
// consume the period sequence.

export type DocType =
  | "invoice"
  | "bill"
  | "quote"
  | "po"
  | "credit-note"
  | "je"
  | "receipt"
  | "debit-note"
  | "wht-certificate"
  | "payment"
  | "je-draft"
  | "invoice-draft"
  // Fixed-asset codes, one race-safe counter per asset class per year:
  // FA-IT-{YYYY}-NNN / FA-PFA-{YYYY}-NNN / FA-FF-{YYYY}-NNN (PRD §3.A.4).
  | "fa-it"
  | "fa-pfa"
  | "fa-ff"
  // Physical count session (WS4). One annual series per entity.
  | "fa-count";

export const MONTHLY_SEQ_MAX = 999;

const STATUTORY_MONTHLY = new Set<DocType>([
  "je",
  "invoice",
  "receipt",
  "bill",
]);

// Default prefix + zero-pad width (and optional reset cadence) used when a
// DocumentSequence row does not yet exist for an (entity, docType). Admins can
// later override the prefix / width on the row; these are only the first-use
// seed values. `resetPeriod` defaults the counter's restart cadence at first
// use so a per-year sequence (e.g. fixed-asset codes) starts fresh each year
// without pre-seeding a row — omit it for the legacy ever-growing behaviour.
export const DOC_TYPE_DEFAULTS: Record<
  DocType,
  { prefix: string; padWidth: number; resetPeriod?: ResetPeriod }
> = {
  invoice: { prefix: "INV{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  bill: { prefix: "EXP{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  quote: { prefix: "QT-", padWidth: 5 },
  po: { prefix: "PO-", padWidth: 5 },
  "credit-note": { prefix: "CN-", padWidth: 5 },
  je: { prefix: "JE{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  receipt: { prefix: "RCP{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  "debit-note": { prefix: "DN-", padWidth: 5 },
  "wht-certificate": { prefix: "WHT-", padWidth: 5 },
  payment: { prefix: "PAY-", padWidth: 5 },
  "je-draft": { prefix: "DRAFT-", padWidth: 6 },
  "invoice-draft": { prefix: "DRAFT-INV-", padWidth: 6 },
  "fa-it": { prefix: "FA-IT-{YYYY}-", padWidth: 3, resetPeriod: "annual" },
  "fa-pfa": { prefix: "FA-PFA-{YYYY}-", padWidth: 3, resetPeriod: "annual" },
  "fa-ff": { prefix: "FA-FF-{YYYY}-", padWidth: 3, resetPeriod: "annual" },
  // A count series resets annually (one stocktake cycle per year), so the
  // prefix MUST carry {YYYY}: without it the 2027 counter restarts at 0001 and
  // collides with FAC-0001 from 2026 on FixedAssetCountSession's
  // @@unique([entityId, sessionNo]) — a hard insert failure every new year.
  // Same reason every fa-* code above is year-tokenised.
  "fa-count": { prefix: "FAC-{YYYY}-", padWidth: 4, resetPeriod: "annual" },
};

// ── Period buckets (monthly / annual counter reset) ─────────────────────────

export type ResetPeriod = "none" | "monthly" | "annual";

// The concrete period a document number is being allocated in. `key` is the
// uniqueness bucket persisted on the row; the token fields feed prefix
// substitution ({YYYY} / {YY} / {MM}).
export interface DocPeriod {
  key: string;
  year: string;
  yearShort: string;
  month: string;
}

// Asia/Bangkok is UTC+7 with no DST, so a fixed offset is exact. Mirrors the
// "today" computation already used by runStatusChecks.
function bangkokParts(now: Date): { year: number; month: number } {
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { year: bkk.getUTCFullYear(), month: bkk.getUTCMonth() + 1 };
}

// Compute the period bucket for a reset cadence. "none" → constant "" bucket
// (single ever-growing counter, unchanged from the original behavior).
export function computePeriod(
  resetPeriod: string,
  now: Date = new Date(),
): DocPeriod {
  const { year, month } = bangkokParts(now);
  const yyyy = String(year);
  const yy = yyyy.slice(-2);
  const mm = String(month).padStart(2, "0");
  const key =
    resetPeriod === "monthly"
      ? `${yyyy}${mm}`
      : resetPeriod === "annual"
        ? yyyy
        : "";
  return { key, year: yyyy, yearShort: yy, month: mm };
}

// Substitute year/month tokens in a prefix. No-op when no period is supplied or
// the prefix carries no tokens — so default doc types render exactly as before.
function applyPeriodTokens(prefix: string, period?: DocPeriod): string {
  if (!period) return prefix;
  return prefix
    .replaceAll("{YYYY}", period.year)
    .replaceAll("{YY}", period.yearShort)
    .replaceAll("{MM}", period.month);
}

// Pure formatter — kept separate so it can be unit-tested without a DB. When a
// `period` is passed, {YYYY}/{YY}/{MM} tokens in the prefix are resolved first.
export function formatDocNumber(
  prefix: string,
  seq: number,
  padWidth: number,
  period?: DocPeriod,
): string {
  const resolvedPrefix = applyPeriodTokens(prefix, period);
  return `${resolvedPrefix}${String(seq).padStart(padWidth, "0")}`;
}

// Allocate the next document number for (entity, docType). MUST run inside a
// transaction (`tx`). The single `upsert` compiles to a native
// INSERT … ON CONFLICT DO UPDATE on Postgres, so concurrent allocations
// serialize on the row lock and never hand out a duplicate number.
//
// The counter is bucketed by the doc type's configured reset cadence: a
// lightweight config read discovers `resetPeriod` (shared across a doc type's
// period rows), the document-date (Asia/Bangkok) period is derived, and the
// counter is allocated per (entity, docType, periodKey) so monthly/annual
// resets each own an independent sequence. `resetPeriod='none'` keeps the
// constant "" bucket — identical to the original per-(entity, docType)
// behavior.
//
// Statutory monthly types (je/invoice/receipt/bill) always use the PRD
// prefix+YYYYMM+3-digit defaults, even when a legacy ever-growing
// `resetPeriod='none'` row exists from the old JE-/INV- series. New issues
// therefore start a fresh monthly bucket and cannot collide with JE-000001.
//
// Convention: `nextNumber` always holds the NEXT unallocated value. On first
// use we create the row already pointing at 2 (having consumed 1); on reuse we
// increment. Either way the number just consumed is `row.nextNumber - 1`.
export async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  entityId: string,
  docType: DocType,
  documentDate: Date = new Date(),
): Promise<string> {
  const def = DOC_TYPE_DEFAULTS[docType];
  const statutory = STATUTORY_MONTHLY.has(docType);

  // Discover the configured reset cadence + prefix/width for this doc type.
  // All period rows for a doc type share these; the oldest row is the config
  // of record. A missing row means first-ever use → defaults.
  // Statutory monthly types ignore a legacy none-row so the PRD format wins.
  const config = statutory
    ? null
    : await tx.documentSequence.findFirst({
        where: { entityId, docType },
        orderBy: { createdAt: "asc" },
        select: { resetPeriod: true, prefix: true, padWidth: true },
      });
  const resetPeriod = config?.resetPeriod ?? def.resetPeriod ?? "none";
  const prefix = config?.prefix ?? def.prefix;
  const padWidth = config?.padWidth ?? def.padWidth;
  const period = computePeriod(resetPeriod, documentDate);

  const row = await tx.documentSequence.upsert({
    where: {
      entityId_docType_periodKey: { entityId, docType, periodKey: period.key },
    },
    create: {
      entityId,
      docType,
      prefix,
      padWidth,
      resetPeriod,
      periodKey: period.key,
      nextNumber: 2,
    },
    update: { nextNumber: { increment: 1 } },
  });
  const seq = row.nextNumber - 1;
  if (resetPeriod === "monthly" && seq > MONTHLY_SEQ_MAX) {
    throw new BadRequestException(
      `Monthly sequence for ${docType} ${period.key} is full (${MONTHLY_SEQ_MAX}).`,
      [
        {
          message: `Cannot issue more than ${MONTHLY_SEQ_MAX} ${docType} documents in ${period.key}`,
          messageTh: `ออกเอกสาร ${docType} ได้ไม่เกิน ${MONTHLY_SEQ_MAX} ฉบับในเดือน ${period.key}`,
        },
      ],
    );
  }
  return formatDocNumber(row.prefix, seq, row.padWidth, period);
}

export async function allocateDraftNumber(
  tx: Prisma.TransactionClient,
  entityId: string,
  kind: "je" | "invoice",
): Promise<string> {
  return allocateDocumentNumber(
    tx,
    entityId,
    kind === "je" ? "je-draft" : "invoice-draft",
  );
}
