/**
 * Shared utilities, types, and constants used across the expense module.
 */

import { and, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import type { AnyColumn } from "drizzle-orm";
import { R2_PRIVATE_PREFIX } from "../certificates/certificates.service";
import { getSetting } from "../survey/system-settings.repository";

export const OFFICE_SUBMITTER_LABEL = "Office Admin";

export function buildReportSearchCondition(
  search: string | undefined | null,
  employeeNameColumn: { name: AnyColumn },
): SQL | undefined {
  const q = search?.trim();
  if (!q) return undefined;
  const like = `%${q}%`;
  const branches: SQL[] = [
    ilike(schema.expenseReports.title, like),
    ilike(schema.expenseReports.period, like),
    and(ne(schema.expenseReports.category, "office"), ilike(employeeNameColumn.name, like))!,
  ];
  if (OFFICE_SUBMITTER_LABEL.toLowerCase().includes(q.toLowerCase())) {
    branches.push(eq(schema.expenseReports.category, "office"));
  }
  return or(...branches);
}

export function fmtAmount(amount: number | string, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export const EXPENSE_REMINDER_TIMEZONE = "Asia/Bangkok";
export const EXPENSE_REMINDER_DAY_OF_MONTH = 22;
export const EXPENSE_REMINDER_TIME = "09:00";
export const FILED_EXPENSE_REPORT_STATUSES = ["submitted", "approved", "reimbursed"] as const;

export function datePartsInTimezone(at: Date, timezone: string): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) throw new Error(`Failed to resolve calendar date in timezone "${timezone}"`);
  return { year, month, day };
}

export function bangkokDateParts(at: Date) { return datePartsInTimezone(at, EXPENSE_REMINDER_TIMEZONE); }
export function currentExpensePeriodInTimezone(at = new Date(), timezone = EXPENSE_REMINDER_TIMEZONE) {
  const { year, month } = datePartsInTimezone(at, timezone);
  return `${year}-${month}`;
}
export function currentExpensePeriodBangkok(at = new Date()) { return currentExpensePeriodInTimezone(at, EXPENSE_REMINDER_TIMEZONE); }
export function isExpenseReminderDayBangkok(at = new Date()) { return Number(bangkokDateParts(at).day) === EXPENSE_REMINDER_DAY_OF_MONTH; }
export function expensePeriodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
export function expenseReminderVariantForEntityCode(entityCode: string | null | undefined): "thailand" | "international" {
  return entityCode === "TH" ? "thailand" : "international";
}

export const EXPENSE_NOTIFICATION_KEY = "expense.notification_recipients";
export type ExpenseRecipientMode = "approved" | "everything";
export interface ExpenseRecipient { email: string; mode: ExpenseRecipientMode; }

export async function loadExpenseNotificationRecipients(db: Db): Promise<ExpenseRecipient[]> {
  const value = await getSetting(db, EXPENSE_NOTIFICATION_KEY);
  if (!value || !Array.isArray(value)) return [];
  const out: ExpenseRecipient[] = [];
  for (const item of value) {
    if (typeof item === "string") { out.push({ email: item, mode: "approved" }); continue; }
    if (item && typeof item === "object" && "email" in item && typeof (item as { email: unknown }).email === "string") {
      const rec = item as { email: string; mode?: unknown };
      out.push({ email: rec.email, mode: rec.mode === "everything" ? "everything" : "approved" });
    }
  }
  return out;
}

export function recipientEmailsFor(recipients: ExpenseRecipient[], mode: ExpenseRecipientMode | "any"): string[] {
  return recipients.filter((r) => mode === "any" || r.mode === mode).map((r) => r.email);
}

export async function signReceiptUrlIfNeeded(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith(R2_PRIVATE_PREFIX)) return url;
  return url;
}

export async function withSignedReceipt<T extends { receiptUrl?: string | null }>(row: T): Promise<T> {
  if (!row.receiptUrl) return row;
  return { ...row, receiptUrl: await signReceiptUrlIfNeeded(row.receiptUrl) };
}

export async function withSignedReceipts<T extends { receiptUrl?: string | null }>(rows: T[]): Promise<T[]> {
  return Promise.all(rows.map((r) => withSignedReceipt(r)));
}

export function parseR2ReceiptKey(receiptUrl: string | null | undefined): string | null {
  if (!receiptUrl?.startsWith(R2_PRIVATE_PREFIX)) return null;
  return receiptUrl.slice(R2_PRIVATE_PREFIX.length);
}
