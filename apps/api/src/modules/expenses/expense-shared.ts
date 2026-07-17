/**
 * Shared utilities, types, and constants used across the expense
 * sub-service files.  Keep this file free of business logic — it is
 * a pure helper layer with no opinion about workflows.
 */

import { prisma } from "@/infrastructure/database/prisma";
import {
  createSignedUrl,
  parseStorageUrl,
  requireRegisteredStorageUrl,
  STORAGE_BUCKETS,
} from "@/infrastructure/storage/supabase-storage";

// ── Formatting ────────────────────────────────────────────────────

export function fmtAmount(amount: number | string, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// ── Calendar utilities ────────────────────────────────────────────

export const EXPENSE_REMINDER_TIMEZONE = "Asia/Bangkok";
export const EXPENSE_REMINDER_DAY_OF_MONTH = 22;
export const EXPENSE_REMINDER_TIME = "09:00";
export const FILED_EXPENSE_REPORT_STATUSES = [
  "submitted",
  "approved",
  "reimbursed",
] as const;

/**
 * Break a `Date` into year/month/day parts using the given IANA timezone.
 */
export function datePartsInTimezone(
  at: Date,
  timezone: string,
): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(
      `Failed to resolve calendar date in timezone "${timezone}"`,
    );
  }
  return { year, month, day };
}

/** Backward-compat wrapper — callers that don't need configurable TZ. */
export function bangkokDateParts(at: Date): {
  year: string;
  month: string;
  day: string;
} {
  return datePartsInTimezone(at, EXPENSE_REMINDER_TIMEZONE);
}

export function currentExpensePeriodInTimezone(
  at = new Date(),
  timezone = EXPENSE_REMINDER_TIMEZONE,
): string {
  const { year, month } = datePartsInTimezone(at, timezone);
  return `${year}-${month}`;
}

/** Backward-compat wrapper. */
export function currentExpensePeriodBangkok(at = new Date()): string {
  return currentExpensePeriodInTimezone(at, EXPENSE_REMINDER_TIMEZONE);
}

export function isExpenseReminderDayBangkok(at = new Date()): boolean {
  const { day } = bangkokDateParts(at);
  return Number(day) === EXPENSE_REMINDER_DAY_OF_MONTH;
}

export function expensePeriodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function expenseReminderVariantForEntityCode(
  entityCode: string | null | undefined,
): "thailand" | "international" {
  return entityCode === "TH" ? "thailand" : "international";
}

// ── Notification recipients ───────────────────────────────────────

export const EXPENSE_NOTIFICATION_KEY = "expense.notification_recipients";

/**
 * Per-recipient trigger preference.
 * `approved`   — one email per report, on final approval (legacy default).
 * `everything` — also sends a copy at submit time for payroll planning.
 */
export type ExpenseRecipientMode = "approved" | "everything";

export interface ExpenseRecipient {
  email: string;
  mode: ExpenseRecipientMode;
}

/**
 * Tolerates the legacy `string[]` JSON shape so already-saved settings
 * keep working without a migration — plain strings hydrate as
 * `mode: "approved"` (the previous behavior).
 */
export async function loadExpenseNotificationRecipients(): Promise<
  ExpenseRecipient[]
> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: EXPENSE_NOTIFICATION_KEY },
  });
  if (!row) return [];
  const value = row.value;
  if (!Array.isArray(value)) return [];
  const out: ExpenseRecipient[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      out.push({ email: item, mode: "approved" });
      continue;
    }
    if (
      item &&
      typeof item === "object" &&
      "email" in item &&
      typeof (item as { email: unknown }).email === "string"
    ) {
      const rec = item as { email: string; mode?: unknown };
      const mode: ExpenseRecipientMode =
        rec.mode === "everything" ? "everything" : "approved";
      out.push({ email: rec.email, mode });
    }
  }
  return out;
}

export function recipientEmailsFor(
  recipients: ExpenseRecipient[],
  mode: ExpenseRecipientMode | "any",
): string[] {
  return recipients
    .filter((r) => mode === "any" || r.mode === mode)
    .map((r) => r.email);
}

// ── Receipt signed-URL helpers ────────────────────────────────────

/**
 * Receipts live in a private Supabase bucket, so the public URL stored
 * on `Expense.receiptUrl` returns a 400.  Mint a 24 h signed URL before
 * returning the row to the client. External URLs and absent values pass
 * through unchanged; Supabase-shaped URLs are treated as managed objects and
 * must belong to the expense employee in the dedicated receipts bucket.
 */
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function validateExpenseReceiptUrl(
  url: string | null | undefined,
  employeeId: string,
): Promise<{ bucket: "receipts"; path: string } | null> {
  if (!url) return null;

  // URLs without a Supabase object marker are explicitly supported as
  // external receipt links. A marker means the caller is selecting an object
  // for the service-role client, so origin, bucket, purpose, and ownership all
  // become mandatory.
  if (!parseStorageUrl(url)) return null;

  const parsed = await requireRegisteredStorageUrl(url, {
    allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
    purpose: "expense-receipt",
    uploadedBy: employeeId,
  });

  return { bucket: STORAGE_BUCKETS.RECEIPTS, path: parsed.path };
}

export async function signReceiptUrlIfNeeded(
  url: string | null | undefined,
  employeeId: string,
): Promise<string | null> {
  if (!url) return null;
  const parsed = await validateExpenseReceiptUrl(url, employeeId);
  if (!parsed) return url;
  try {
    return await createSignedUrl(
      parsed.bucket,
      parsed.path,
      RECEIPT_SIGNED_URL_TTL_SECONDS,
    );
  } catch {
    // Fall back to the raw URL — the FE link will still copy/paste,
    // even if the inline preview won't render.
    return url;
  }
}

export async function withSignedReceipt<
  T extends { employeeId: string; receiptUrl?: string | null },
>(row: T): Promise<T> {
  if (!row.receiptUrl) return row;
  const signed = await signReceiptUrlIfNeeded(row.receiptUrl, row.employeeId);
  return { ...row, receiptUrl: signed };
}

export async function withSignedReceipts<
  T extends { employeeId: string; receiptUrl?: string | null },
>(rows: T[]): Promise<T[]> {
  return Promise.all(rows.map((r) => withSignedReceipt(r)));
}
