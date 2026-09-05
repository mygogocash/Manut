/**
 * Shared utilities, types, and constants used across the expense
 * sub-service files.  Keep this file free of business logic — it is
 * a pure helper layer with no opinion about workflows.
 */

import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  createSignedUrl,
  parseStorageUrl,
} from "@/infrastructure/storage/supabase-storage";

// ── Report search ─────────────────────────────────────────────────

/**
 * The label the UI shows instead of who filed an office report.
 *
 * Duplicated from the web bundle (OFFICE_ADMIN_SUBMITTER_LABEL) because the
 * search has to agree with what the reader can actually see: matching an office
 * report by its submitter's name would surface it under a person's name while the
 * table still rendered "Office Admin", revealing exactly what the masking hides.
 */
export const OFFICE_SUBMITTER_LABEL = "Office Admin";

/**
 * Free-text filter for the expense report list: title, period, or employee name.
 *
 * Returns `null` when there is nothing to match, so callers can skip it entirely
 * rather than AND-ing a clause that matches everything.
 *
 * Nested under `AND` rather than assigned as a sibling `where.OR`. Prisma ANDs
 * sibling keys, so a sibling would also intersect the permission scoping
 * correctly today — but there would then be exactly one `OR` slot on the object,
 * and a second filter wanting its own would silently overwrite this one. A group
 * under `AND` composes.
 *
 * The employee-name branch is guarded on `category != "office"`, and office
 * reports are instead reached by matching their visible label — mirroring the
 * browser filter this replaced, so the two agree on what a term means.
 */
export function reportSearchWhere(
  search: string | undefined | null,
): Prisma.ExpenseReportWhereInput | null {
  const q = search?.trim();
  if (!q) return null;

  const or: Prisma.ExpenseReportWhereInput[] = [
    { title: { contains: q, mode: "insensitive" } },
    // `period` is a YYYY-MM string, so a plain contains covers "2026", "2026-07"
    // and "07". No mode needed — it holds no letters.
    { period: { contains: q } },
    {
      AND: [
        { category: { not: "office" } },
        { employee: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
  ];

  if (OFFICE_SUBMITTER_LABEL.toLowerCase().includes(q.toLowerCase())) {
    or.push({ category: "office" });
  }

  return { AND: [{ OR: or }] };
}

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
 * returning the row to the client.  Public-bucket URLs and absent values
 * pass through unchanged.
 */
export const PRIVATE_BUCKETS = new Set(["receipts", "documents"]);
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function signReceiptUrlIfNeeded(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;
  if (!PRIVATE_BUCKETS.has(parsed.bucket)) return url;
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
  T extends { receiptUrl?: string | null },
>(row: T): Promise<T> {
  if (!row.receiptUrl) return row;
  const signed = await signReceiptUrlIfNeeded(row.receiptUrl);
  return { ...row, receiptUrl: signed };
}

export async function withSignedReceipts<
  T extends { receiptUrl?: string | null },
>(rows: T[]): Promise<T[]> {
  return Promise.all(rows.map((r) => withSignedReceipt(r)));
}
