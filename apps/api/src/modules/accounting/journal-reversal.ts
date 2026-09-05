// Warnings raised when a posted journal is reversed.
//
// A reversal is only ever created when the original sits in a CLOSED period, so
// its effect necessarily lands in a LATER month than the entry it undoes. That
// is the point — a closed month must not move — but it has two consequences a
// person needs to be told about before they confirm, because neither is visible
// in the resulting journal.
//
// Pure + DB-free: the caller resolves which accounts carry which role and hands
// the answer in as booleans.

/** Mapping roles whose accounts sit on a VAT return. */
export const VAT_MAPPING_ROLES = [
  "vat_output",
  "vat_output_deferred",
  "vat_input",
  "vat_input_deferred",
] as const;

/** Mapping role for the year-end closing account. */
export const RETAINED_EARNINGS_ROLE = "retained_earnings";

export type ReversalWarningCode =
  "reversal_affects_tax_filing" | "reversal_affects_retained_earnings";

export interface ReversalWarning {
  code: ReversalWarningCode;
  message: string;
  messageTh: string;
}

function yearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * What the person cancelling this journal needs to know.
 *
 * - **VAT** — the original month's return has already been filed. Reversing a
 *   line that touches input or output VAT does not amend that return; it moves
 *   the tax into the return for the month the reversal lands in. Where the
 *   underlying document was a sale or purchase, a credit note is usually the
 *   correct instrument instead, so the warning says so.
 * - **Retained earnings** — a year-end closing entry closes into retained
 *   earnings, so reversing one restates the opening balance carried forward,
 *   not just this year's figures. That is a bigger decision than a normal
 *   reversal and should not be made without whoever signs off the accounts.
 */
export function reversalWarnings(opts: {
  touchesVat: boolean;
  touchesRetainedEarnings: boolean;
  originalDate: Date;
  reverseDate: Date;
}): ReversalWarning[] {
  const out: ReversalWarning[] = [];
  const from = yearMonth(opts.originalDate);
  const to = yearMonth(opts.reverseDate);

  if (opts.touchesVat) {
    out.push({
      code: "reversal_affects_tax_filing",
      message: `This entry touches a VAT account. Reversing it does not amend the ${from} return — the tax moves into the ${to} return instead. If the original was a sale or purchase, issue a credit note rather than reversing.`,
      messageTh: `รายการนี้กระทบบัญชีภาษีมูลค่าเพิ่ม การกลับรายการไม่ได้แก้แบบของเดือน ${from} แต่จะไปกระทบแบบของเดือน ${to} แทน ถ้าเอกสารต้นทางเป็นการขายหรือการซื้อ ควรออกใบลดหนี้แทนการกลับรายการ`,
    });
  }

  if (opts.touchesRetainedEarnings) {
    out.push({
      code: "reversal_affects_retained_earnings",
      message: `This entry touches retained earnings, so it looks like a year-end closing entry. Reversing it restates the opening balance carried forward, not only the current year. Get sign-off before continuing.`,
      messageTh: `รายการนี้กระทบบัญชีกำไรสะสม ซึ่งน่าจะเป็นรายการปรับปรุงปิดบัญชีสิ้นปี การกลับรายการจะกระทบกำไรสะสมยกมา ไม่ใช่เฉพาะปีปัจจุบัน ต้องให้ผู้อนุมัติระดับหัวหน้ารับทราบก่อน`,
    });
  }

  return out;
}
