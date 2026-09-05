import type {
  CreateSubscriptionInput,
  CreateVendorInput,
  MonthDetailQuery,
  MonthlySeriesQuery,
  SubscriptionQuery,
  UpdateSubscriptionInput,
  UpdateVendorInput,
} from "@nexora/contracts/modules/it-billing/it-billing.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import {
  buildMonthDetail,
  buildMonthlySeries,
  monthKey,
  type MonthlySubscription,
  pickPrimaryCurrency,
  realisedSavings,
  resolveWindow,
  summariseSeries,
  toMonthlySpend,
} from "./it-billing-monthly";
import * as repo from "./repository";

const EXPIRING_SOON_DAYS = 7;

function parseDate(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return v;
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  return new Date(`${v}T00:00:00.000Z`);
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(`${date}T00:00:00.000Z`).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function effectiveStatus(row: { status: string; paymentStatus: string; renewalDate: string | null }) {
  if (row.status === "cancelled" || row.status === "renewed") return row.status;
  if (row.paymentStatus === "overdue") return "pending-payment";
  const d = daysUntil(row.renewalDate);
  if (d !== null && d <= EXPIRING_SOON_DAYS && d >= 0) return "expiring-soon";
  return row.status === "expiring-soon" ? "active" : row.status;
}

function seatMetrics(s: {
  totalSeats: number | null;
  assignedSeats: number;
  activeSeats: number;
  invoiceAmount: string | number;
  billingFrequency: string;
}) {
  const total = s.totalSeats ?? 0;
  const unusedSeats = total > 0 ? Math.max(0, total - s.assignedSeats) : 0;
  const utilizationPercentage =
    total > 0 ? Math.round((s.activeSeats / total) * 1000) / 10 : null;
  const monthly = toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency);
  const perSeatMonthly = total > 0 ? monthly / total : 0;
  const potentialMonthlySavings = Math.round(perSeatMonthly * unusedSeats * 100) / 100;
  return {
    totalSeats: s.totalSeats,
    assignedSeats: s.assignedSeats,
    activeSeats: s.activeSeats,
    unusedSeats,
    utilizationPercentage,
    potentialMonthlySavings,
  };
}

function vendorDTO(v: Awaited<ReturnType<typeof repo.findVendor>>) {
  if (!v) return null;
  return {
    id: v.id,
    name: v.name,
    contactPerson: v.contactPerson,
    email: v.email,
    phone: v.phone,
    notes: v.notes,
    isActive: v.isActive,
    subscriptionCount: v.subscriptionCount,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function subscriptionDTO(s: NonNullable<Awaited<ReturnType<typeof repo.findSubscription>>>) {
  const renewalIn = daysUntil(s.renewalDate);
  return {
    id: s.id,
    vendorId: s.vendorId,
    vendor: s.vendor,
    category: s.category,
    productName: s.productName,
    contractStartDate: s.contractStartDate,
    renewalDate: s.renewalDate,
    renewalInDays: renewalIn,
    billingFrequency: s.billingFrequency,
    invoiceAmount: Number(s.invoiceAmount),
    monthlySpend: toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency),
    currency: s.currency,
    paymentStatus: s.paymentStatus,
    status: s.status,
    effectiveStatus: effectiveStatus(s),
    owner: s.owner,
    ownerUserId: s.ownerUserId,
    notes: s.notes,
    ...seatMetrics(s),
    renewalDecision: s.renewalDecision,
    renewalDecisionAt: s.renewalDecisionAt,
    renewalDecisionNotes: s.renewalDecisionNotes,
    cancelledAt: s.cancelledAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function toMonthlySubscription(row: Awaited<ReturnType<typeof repo.subscriptionsForMonthlySeries>>[number]): MonthlySubscription {
  const s = row.sub;
  return {
    id: s.id,
    productName: s.productName,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    category: s.category,
    currency: s.currency,
    invoiceAmount: Number(s.invoiceAmount),
    billingFrequency: s.billingFrequency,
    status: s.status,
    contractStartDate: toDate(s.contractStartDate),
    renewalDate: toDate(s.renewalDate),
    cancelledAt: toDate(s.cancelledAt),
    renewalDecision: s.renewalDecision,
    renewalDecisionAt: s.renewalDecisionAt ? new Date(s.renewalDecisionAt) : null,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}

async function monthlySubscriptions(db: Db) {
  const rows = await repo.subscriptionsForMonthlySeries(db);
  return rows.map(toMonthlySubscription);
}

export async function listVendors(db: Db) {
  const rows = await repo.listVendors(db);
  return { data: rows.map((v) => vendorDTO(v)!) };
}

export async function createVendor(db: Db, input: CreateVendorInput, actorId: string) {
  const row = await repo.createVendor(db, {
    name: input.name,
    contactPerson: input.contactPerson ?? null,
    email: input.email || null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
    createdBy: actorId,
  });
  return { data: vendorDTO(row) };
}

export async function updateVendor(db: Db, id: string, input: UpdateVendorInput) {
  const existing = await repo.findVendor(db, id);
  if (!existing) throw new NotFoundException("Vendor not found");
  const row = await repo.updateVendor(db, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });
  return { data: vendorDTO(row) };
}

export async function deleteVendor(db: Db, id: string) {
  const existing = await repo.findVendor(db, id);
  if (!existing) throw new NotFoundException("Vendor not found");
  await repo.deleteVendor(db, id);
  return { data: { id } };
}

export async function listSubscriptions(db: Db, query: SubscriptionQuery) {
  const { rows, total } = await repo.listSubscriptions(db, query, query.page, query.limit);
  return {
    data: rows.map(subscriptionDTO),
    meta: { page: query.page, limit: query.limit, total },
  };
}

export async function getSubscription(db: Db, id: string) {
  const row = await repo.findSubscription(db, id);
  if (!row) throw new NotFoundException("Subscription not found");
  return { data: subscriptionDTO(row) };
}

export async function createSubscription(db: Db, input: CreateSubscriptionInput, actorId: string) {
  const row = await repo.createSubscription(db, {
    vendorId: input.vendorId,
    category: input.category,
    productName: input.productName,
    contractStartDate: parseDate(input.contractStartDate) ?? null,
    renewalDate: parseDate(input.renewalDate) ?? null,
    billingFrequency: input.billingFrequency,
    invoiceAmount: String(input.invoiceAmount),
    currency: input.currency,
    paymentStatus: input.paymentStatus,
    status: input.status,
    ownerUserId: input.ownerUserId ?? null,
    notes: input.notes ?? null,
    cancelledAt: parseDate(input.cancelledAt) ?? null,
    totalSeats: input.totalSeats ?? null,
    assignedSeats: input.assignedSeats ?? 0,
    activeSeats: input.activeSeats ?? 0,
    createdBy: actorId,
  });
  return { data: subscriptionDTO(row!) };
}

export async function updateSubscription(db: Db, id: string, input: UpdateSubscriptionInput) {
  const existing = await repo.findSubscription(db, id);
  if (!existing) throw new NotFoundException("Subscription not found");
  const row = await repo.updateSubscription(db, id, {
    ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.productName !== undefined ? { productName: input.productName } : {}),
    ...(input.contractStartDate !== undefined
      ? { contractStartDate: parseDate(input.contractStartDate) ?? null }
      : {}),
    ...(input.renewalDate !== undefined ? { renewalDate: parseDate(input.renewalDate) ?? null } : {}),
    ...(input.billingFrequency !== undefined ? { billingFrequency: input.billingFrequency } : {}),
    ...(input.invoiceAmount !== undefined ? { invoiceAmount: String(input.invoiceAmount) } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId ?? null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    ...(input.cancelledAt !== undefined ? { cancelledAt: parseDate(input.cancelledAt) ?? null } : {}),
    ...(input.totalSeats !== undefined ? { totalSeats: input.totalSeats ?? null } : {}),
    ...(input.assignedSeats !== undefined ? { assignedSeats: input.assignedSeats } : {}),
    ...(input.activeSeats !== undefined ? { activeSeats: input.activeSeats } : {}),
  });
  return { data: subscriptionDTO(row!) };
}

export async function deleteSubscription(db: Db, id: string) {
  const existing = await repo.findSubscription(db, id);
  if (!existing) throw new NotFoundException("Subscription not found");
  await repo.deleteSubscription(db, id);
  return { data: { id } };
}

export async function monthlySeriesReport(db: Db, query: MonthlySeriesQuery) {
  const rows = await monthlySubscriptions(db);
  const today = new Date();
  const window = resolveWindow(query, today);
  const currency = query.currency ?? pickPrimaryCurrency(rows, today);
  const series = buildMonthlySeries(rows, { ...window, currency });
  const savings = realisedSavings(rows, { ...window, currency, today: monthKey(today) });
  return {
    data: {
      ...series,
      summary: summariseSeries(series, savings),
      endedInWindow: savings.ended,
    },
  };
}

export async function monthlyDetailReport(db: Db, query: MonthDetailQuery) {
  const rows = await monthlySubscriptions(db);
  const currency = query.currency ?? pickPrimaryCurrency(rows, new Date());
  return { data: buildMonthDetail(rows, query.month, currency) };
}

/** Legacy list stub — subscriptions listing is authoritative. */
export async function list(db: Db, _userId: string, _perms: string[], query: SubscriptionQuery) {
  return listSubscriptions(db, query);
}

export async function getById(db: Db, id: string) {
  return getSubscription(db, id);
}

export async function dashboard(_db: Db) {
  return { ok: true };
}


export const RENEWAL_SOON_DAYS = 30;

export async function monthlySpendReport(db: Db) {
  const subs = await repo.activeSubscriptions(db);
  const byCurrency = new Map<string, number>();
  for (const s of subs) {
    const monthly = toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency);
    byCurrency.set(s.currency, (byCurrency.get(s.currency) ?? 0) + monthly);
  }
  return {
    data: {
      totalMonthlyByCurrency: Object.fromEntries(byCurrency),
      annualizedByCurrency: Object.fromEntries([...byCurrency].map(([c, v]) => [c, v * 12])),
      subscriptionCount: subs.length,
    },
  };
}

export async function vendorCostReport(db: Db) {
  const subs = await repo.activeSubscriptions(db);
  const byVendor = new Map<string, { name: string; monthly: number; count: number }>();
  for (const s of subs) {
    const key = s.vendor.id;
    const cur = byVendor.get(key) ?? { name: s.vendor.name, monthly: 0, count: 0 };
    cur.monthly += toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency);
    cur.count += 1;
    byVendor.set(key, cur);
  }
  return {
    data: [...byVendor.entries()]
      .map(([vendorId, v]) => ({
        vendorId,
        vendorName: v.name,
        monthlySpend: v.monthly,
        annualSpend: v.monthly * 12,
        subscriptionCount: v.count,
      }))
      .sort((a, b) => b.monthlySpend - a.monthlySpend),
  };
}

export async function upcomingRenewalsReport(db: Db, days = RENEWAL_SOON_DAYS) {
  if (days < 1 || days > 365) {
    throw new BadRequestException("days must be between 1 and 365");
  }
  const within = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const subs = await repo.upcomingRenewals(db, within);
  return {
    data: subs.map((s) => ({
      id: s.id,
      productName: s.productName,
      vendorName: s.vendor.name,
      renewalDate: s.renewalDate,
      renewalInDays: daysUntil(s.renewalDate),
      invoiceAmount: Number(s.invoiceAmount),
      currency: s.currency,
      paymentStatus: s.paymentStatus,
    })),
  };
}

export async function licenseSummary(db: Db) {
  const subs = await repo.activeSubscriptions(db);
  let totalLicenses = 0;
  let assignedLicenses = 0;
  let unusedLicenses = 0;
  const savingsByCurrency = new Map<string, number>();
  for (const s of subs) {
    const m = seatMetrics(s);
    if (!m.totalSeats) continue;
    totalLicenses += m.totalSeats;
    assignedLicenses += m.assignedSeats;
    unusedLicenses += m.unusedSeats;
    savingsByCurrency.set(
      s.currency,
      (savingsByCurrency.get(s.currency) ?? 0) + m.potentialMonthlySavings,
    );
  }
  return {
    data: {
      totalLicenses,
      assignedLicenses,
      unusedLicenses,
      potentialMonthlySavingsByCurrency: Object.fromEntries(savingsByCurrency),
      potentialAnnualSavingsByCurrency: Object.fromEntries(
        [...savingsByCurrency].map(([c, v]) => [c, Math.round(v * 12 * 100) / 100]),
      ),
    },
  };
}

export async function licenseUtilizationReport(db: Db, query: import("@nexora/contracts/modules/it-billing/it-billing.validation").LicenseReportQuery) {
  const subs = await repo.activeSubscriptions(db);
  const filtered = subs.filter((s) => {
    if (query.vendorId && s.vendorId !== query.vendorId) return false;
    if (query.category && s.category !== query.category) return false;
    if (query.status && s.status !== query.status) return false;
    return true;
  });
  return {
    data: filtered
      .map((s) => {
        const m = seatMetrics(s);
        return {
          id: s.id,
          productName: s.productName,
          vendorName: s.vendor.name,
          category: s.category,
          status: s.status,
          currency: s.currency,
          monthlyCost: toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency),
          ...m,
        };
      })
      .sort((a, b) => b.potentialMonthlySavings - a.potentialMonthlySavings),
  };
}

export async function listAlerts(db: Db, onlyOpen: boolean) {
  const rows = await repo.listAlerts(db, onlyOpen);
  return {
    data: rows.map((a) => ({
      id: a.id,
      subscriptionId: a.subscriptionId,
      subscription: a.subscription,
      alertType: a.alertType,
      message: a.message,
      acknowledged: a.acknowledged,
      createdAt: a.createdAt,
    })),
  };
}

export async function acknowledgeAlert(db: Db, id: string, actorId: string) {
  const row = await repo.acknowledgeAlert(db, id, actorId);
  return { data: { id: row.id, acknowledged: row.acknowledged } };
}

export async function recordRenewalDecision(
  db: Db,
  id: string,
  input: import("@nexora/contracts/modules/it-billing/it-billing.validation").RenewalDecisionInput,
  actorId: string,
) {
  const existing = await repo.findSubscription(db, id);
  if (!existing) throw new NotFoundException("Subscription not found");
  const nextStatus = input.decision === "renew" ? "renewed" : "cancelled";
  const cancelledAt =
    input.decision === "renew"
      ? null
      : (parseDate(input.effectiveDate) ?? existing.renewalDate ?? new Date().toISOString().slice(0, 10));
  const row = await repo.updateSubscription(db, id, {
    status: nextStatus,
    renewalDecision: input.decision,
    renewalDecisionAt: new Date().toISOString(),
    renewalDecisionBy: actorId,
    renewalDecisionNotes: input.notes ?? null,
    cancelledAt,
    remindersSent: [],
  });
  return { data: subscriptionDTO(row!) };
}

export async function pendingRenewalDecisions(db: Db) {
  const within = new Date(Date.now() + RENEWAL_SOON_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const subs = await repo.upcomingRenewals(db, within);
  return {
    data: subs
      .filter((s) => !s.renewalDecision)
      .map((s) => ({
        id: s.id,
        productName: s.productName,
        vendorName: s.vendor.name,
        renewalDate: s.renewalDate,
        renewalInDays: daysUntil(s.renewalDate),
        invoiceAmount: Number(s.invoiceAmount),
        currency: s.currency,
      })),
  };
}
