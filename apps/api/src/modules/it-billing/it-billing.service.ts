import type { Prisma } from "@nexora/database";
import type { Request } from "express";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logAudit } from "@/infrastructure/audit/audit.service";
import {
  itBillingRepository,
  type ItSubscriptionWithRelations,
} from "@/modules/it-billing/it-billing.repository";
import type {
  AddAttachmentInput,
  CreateBillingRecordInput,
  CreateSubscriptionInput,
  CreateVendorInput,
  LicenseReportQuery,
  MonthDetailQuery,
  MonthlySeriesQuery,
  RemoveAttachmentInput,
  RenewalDecisionInput,
  SubscriptionQuery,
  UpdateBillingRecordInput,
  UpdateSubscriptionInput,
  UpdateVendorInput,
} from "@/modules/it-billing/it-billing.validation";
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
} from "@/modules/it-billing/it-billing-monthly";

/**
 * Re-exported, not defined here.
 *
 * The definition moved to `it-billing-monthly.ts` because `chargeInMonth` needs
 * it and that module must not import this one (circular). Re-exporting keeps the
 * import path `it-operations.service.ts` and the existing tests already use.
 */
export { toMonthlySpend };

interface Attachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  kind?: string;
}

/** Normalize a stored JSON attachments column into a typed array. */
function readAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is Attachment =>
      !!a && typeof a === "object" && typeof (a as Attachment).url === "string",
  );
}

/**
 * License utilization for a subscription. unusedSeats + utilizationPercentage
 * are DERIVED here (never stored) so they can't drift from the source counts.
 * `potentialMonthlySavings` = per-seat monthly cost x unused seats.
 */
export function seatMetrics(s: {
  totalSeats: number | null;
  assignedSeats: number;
  activeSeats: number;
  invoiceAmount: unknown;
  billingFrequency: string;
}) {
  const total = s.totalSeats ?? 0;
  const unusedSeats = total > 0 ? Math.max(0, total - s.assignedSeats) : 0;
  const utilizationPercentage =
    total > 0 ? Math.round((s.activeSeats / total) * 1000) / 10 : null;
  const monthly = toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency);
  const perSeatMonthly = total > 0 ? monthly / total : 0;
  const potentialMonthlySavings =
    Math.round(perSeatMonthly * unusedSeats * 100) / 100;
  return {
    totalSeats: s.totalSeats,
    assignedSeats: s.assignedSeats,
    activeSeats: s.activeSeats,
    unusedSeats,
    utilizationPercentage,
    potentialMonthlySavings,
  };
}

const RESOURCE = "it-billing";

/** Days-out window the renewal reports + reminder ladder consider "upcoming". */
export const RENEWAL_SOON_DAYS = 30;

/**
 * Days from now within which the UI shows the "Expiring Soon" badge.
 * Intentionally tighter than the reminder window so the badge only lights
 * up in the final week, while reminder emails still fire at 30/15/7 days.
 */
export const EXPIRING_SOON_DAYS = 7;

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Date(`${v}T00:00:00.000Z`);
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Effective lifecycle badge. Manual terminal states (renewed / cancelled)
 * are respected; otherwise we surface pending-payment / expiring-soon
 * derived from the dates so the list never lies about an overdue renewal.
 */
function effectiveStatus(row: {
  status: string;
  paymentStatus: string;
  renewalDate: Date | null;
}): string {
  if (row.status === "cancelled" || row.status === "renewed") return row.status;
  if (row.paymentStatus === "overdue") return "pending-payment";
  const d = daysUntil(row.renewalDate);
  if (d !== null && d <= EXPIRING_SOON_DAYS && d >= 0) return "expiring-soon";
  return row.status === "expiring-soon" ? "active" : row.status;
}

function vendorDTO(v: {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  attachments?: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { subscriptions: number };
}) {
  return {
    id: v.id,
    name: v.name,
    contactPerson: v.contactPerson,
    email: v.email,
    phone: v.phone,
    notes: v.notes,
    isActive: v.isActive,
    attachments: readAttachments(v.attachments),
    subscriptionCount: v._count?.subscriptions ?? 0,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function subscriptionDTO(s: ItSubscriptionWithRelations) {
  const renewalIn = daysUntil(s.renewalDate);
  return {
    id: s.id,
    vendorId: s.vendorId,
    vendor: s.vendor,
    category: s.category,
    productName: s.productName,
    contractStartDate: s.contractStartDate?.toISOString() ?? null,
    renewalDate: s.renewalDate?.toISOString() ?? null,
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
    renewalDecisionAt: s.renewalDecisionAt?.toISOString() ?? null,
    renewalDecisionNotes: s.renewalDecisionNotes,
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    attachments: readAttachments(s.attachments),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

type MonthlySeriesRow = Awaited<
  ReturnType<typeof itBillingRepository.subscriptionsForMonthlySeries>
>[number];

/**
 * Flatten a subscription row for the month-series engine.
 *
 * The engine takes plain values so it stays pure and its tests need no Prisma —
 * so `Decimal` is coerced to a number exactly here, once, rather than at every
 * use inside the engine.
 */
function toMonthlySubscription(s: MonthlySeriesRow): MonthlySubscription {
  return {
    id: s.id,
    productName: s.productName,
    vendorId: s.vendorId,
    vendorName: s.vendor.name,
    category: s.category,
    currency: s.currency,
    invoiceAmount: Number(s.invoiceAmount),
    billingFrequency: s.billingFrequency,
    status: s.status,
    contractStartDate: s.contractStartDate,
    renewalDate: s.renewalDate,
    cancelledAt: s.cancelledAt,
    renewalDecision: s.renewalDecision,
    renewalDecisionAt: s.renewalDecisionAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export class ItBillingService {
  // ── Vendors ──
  async listVendors() {
    const rows = await itBillingRepository.listVendors();
    return { data: rows.map(vendorDTO) };
  }

  async createVendor(input: CreateVendorInput, actorId: string, req?: Request) {
    const row = await itBillingRepository.createVendor({
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      email: input.email || null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
      createdById: actorId,
    });
    void logAudit({
      action: "create",
      resource: `${RESOURCE}-vendor`,
      resourceId: row.id,
      details: { name: input.name },
      req,
    });
    return { data: vendorDTO(row) };
  }

  async updateVendor(
    id: string,
    input: UpdateVendorInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findVendor(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    const row = await itBillingRepository.updateVendor(id, {
      ...("name" in input ? { name: input.name } : {}),
      ...("contactPerson" in input
        ? { contactPerson: input.contactPerson ?? null }
        : {}),
      ...("email" in input ? { email: input.email || null } : {}),
      ...("phone" in input ? { phone: input.phone ?? null } : {}),
      ...("notes" in input ? { notes: input.notes ?? null } : {}),
      ...("isActive" in input ? { isActive: input.isActive } : {}),
    });
    void logAudit({
      action: "update",
      resource: `${RESOURCE}-vendor`,
      resourceId: id,
      details: { previousName: existing.name, ...input },
      req,
    });
    return { data: vendorDTO(row) };
  }

  async deleteVendor(id: string, _actorId: string, req?: Request) {
    const existing = await itBillingRepository.findVendor(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    await itBillingRepository.deleteVendor(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-vendor`,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return { data: { id } };
  }

  // ── Subscriptions ──
  async listSubscriptions(query: SubscriptionQuery) {
    const where: Parameters<typeof itBillingRepository.countSubscriptions>[0] =
      {};
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.search) {
      where.OR = [
        { productName: { contains: query.search, mode: "insensitive" } },
        { vendor: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }
    const [rows, total] = await Promise.all([
      itBillingRepository.listSubscriptions({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      itBillingRepository.countSubscriptions(where),
    ]);
    return {
      data: rows.map(subscriptionDTO),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async getSubscription(id: string) {
    const row = await itBillingRepository.findSubscription(id);
    if (!row) throw new NotFoundException("Subscription not found");
    return { data: subscriptionDTO(row) };
  }

  async createSubscription(
    input: CreateSubscriptionInput,
    actorId: string,
    req?: Request,
  ) {
    const row = await itBillingRepository.createSubscription({
      vendorId: input.vendorId,
      category: input.category,
      productName: input.productName,
      contractStartDate: parseDate(input.contractStartDate) ?? null,
      renewalDate: parseDate(input.renewalDate) ?? null,
      billingFrequency: input.billingFrequency,
      invoiceAmount: input.invoiceAmount,
      currency: input.currency,
      paymentStatus: input.paymentStatus,
      status: input.status,
      ownerUserId: input.ownerUserId ?? null,
      notes: input.notes ?? null,
      cancelledAt: parseDate(input.cancelledAt) ?? null,
      totalSeats: input.totalSeats ?? null,
      assignedSeats: input.assignedSeats ?? 0,
      activeSeats: input.activeSeats ?? 0,
      createdById: actorId,
    });
    void logAudit({
      action: "create",
      resource: `${RESOURCE}-subscription`,
      resourceId: row.id,
      details: { productName: input.productName, vendorId: input.vendorId },
      req,
    });
    return { data: subscriptionDTO(row) };
  }

  async updateSubscription(
    id: string,
    input: UpdateSubscriptionInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findSubscription(id);
    if (!existing) throw new NotFoundException("Subscription not found");
    const row = await itBillingRepository.updateSubscription(id, {
      ...("vendorId" in input ? { vendorId: input.vendorId } : {}),
      ...("category" in input ? { category: input.category } : {}),
      ...("productName" in input ? { productName: input.productName } : {}),
      ...("contractStartDate" in input
        ? { contractStartDate: parseDate(input.contractStartDate) }
        : {}),
      ...("renewalDate" in input
        ? { renewalDate: parseDate(input.renewalDate) }
        : {}),
      ...("billingFrequency" in input
        ? { billingFrequency: input.billingFrequency }
        : {}),
      ...("invoiceAmount" in input
        ? { invoiceAmount: input.invoiceAmount }
        : {}),
      ...("currency" in input ? { currency: input.currency } : {}),
      ...("paymentStatus" in input
        ? { paymentStatus: input.paymentStatus }
        : {}),
      ...("status" in input ? { status: input.status } : {}),
      ...("ownerUserId" in input
        ? { ownerUserId: input.ownerUserId ?? null }
        : {}),
      ...("notes" in input ? { notes: input.notes ?? null } : {}),
      // Reviving a CANCELLED subscription has to clear the stop date, or the
      // spend series keeps the step-down for ever and the revived cost never
      // comes back.
      //
      // `existing.status === "cancelled"` is load-bearing. Without it, a row
      // that is still active but carries a FUTURE cancelledAt — a scheduled
      // cancellation — had that date wiped by any ordinary edit, because the
      // edit form always sends `status`, and `status: "active"` on a row with a
      // cancelledAt looked exactly like a revival.
      ...(existing.status === "cancelled" &&
      input.status &&
      input.status !== "cancelled" &&
      existing.cancelledAt
        ? { cancelledAt: null }
        : {}),
      // Cancelling through the edit form must stamp a date, not leave one to
      // be inferred. `endMonth`'s last-resort fallback is `updatedAt`, which is
      // MUTABLE: without this, a cancellation with no renewal date had its
      // step-down month silently move every time anyone touched the row again.
      ...(input.status === "cancelled" &&
      !("cancelledAt" in input) &&
      !existing.cancelledAt
        ? { cancelledAt: existing.renewalDate ?? new Date() }
        : {}),
      // Ordered last so a caller that sends an explicit date always wins over
      // either default above.
      ...("cancelledAt" in input
        ? { cancelledAt: parseDate(input.cancelledAt) }
        : {}),
      ...("totalSeats" in input
        ? { totalSeats: input.totalSeats ?? null }
        : {}),
      ...("assignedSeats" in input
        ? { assignedSeats: input.assignedSeats }
        : {}),
      ...("activeSeats" in input ? { activeSeats: input.activeSeats } : {}),
    });
    void logAudit({
      action: "update",
      resource: `${RESOURCE}-subscription`,
      resourceId: id,
      details: { ...input },
      req,
    });
    return { data: subscriptionDTO(row) };
  }

  async deleteSubscription(id: string, _actorId: string, req?: Request) {
    const existing = await itBillingRepository.findSubscription(id);
    if (!existing) throw new NotFoundException("Subscription not found");
    await itBillingRepository.deleteSubscription(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-subscription`,
      resourceId: id,
      details: { productName: existing.productName },
      req,
    });
    return { data: { id } };
  }

  // ── Billing records ──
  async listBillingRecords(subscriptionId: string) {
    const sub = await itBillingRepository.findSubscription(subscriptionId);
    if (!sub) throw new NotFoundException("Subscription not found");
    const rows = await itBillingRepository.listBillingRecords(subscriptionId);
    return {
      data: rows.map((r) => ({
        id: r.id,
        subscriptionId: r.subscriptionId,
        periodStart: r.periodStart?.toISOString() ?? null,
        periodEnd: r.periodEnd?.toISOString() ?? null,
        amount: Number(r.amount),
        currency: r.currency,
        paymentStatus: r.paymentStatus,
        paidAt: r.paidAt?.toISOString() ?? null,
        invoiceUrl: r.invoiceUrl,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async createBillingRecord(
    subscriptionId: string,
    input: CreateBillingRecordInput,
    actorId: string,
    req?: Request,
  ) {
    const sub = await itBillingRepository.findSubscription(subscriptionId);
    if (!sub) throw new NotFoundException("Subscription not found");
    const row = await itBillingRepository.createBillingRecord({
      subscriptionId,
      periodStart: parseDate(input.periodStart) ?? null,
      periodEnd: parseDate(input.periodEnd) ?? null,
      amount: input.amount,
      currency: input.currency,
      paymentStatus: input.paymentStatus,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
      invoiceUrl: input.invoiceUrl ?? null,
      notes: input.notes ?? null,
      createdById: actorId,
    });
    void logAudit({
      action: "create",
      resource: `${RESOURCE}-record`,
      resourceId: row.id,
      details: { subscriptionId, amount: input.amount },
      req,
    });
    return { data: row };
  }

  async updateBillingRecord(
    id: string,
    input: UpdateBillingRecordInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findBillingRecord(id);
    if (!existing) throw new NotFoundException("Billing record not found");
    const row = await itBillingRepository.updateBillingRecord(id, {
      ...("periodStart" in input
        ? { periodStart: parseDate(input.periodStart) }
        : {}),
      ...("periodEnd" in input
        ? { periodEnd: parseDate(input.periodEnd) }
        : {}),
      ...("amount" in input ? { amount: input.amount } : {}),
      ...("currency" in input ? { currency: input.currency } : {}),
      ...("paymentStatus" in input
        ? { paymentStatus: input.paymentStatus }
        : {}),
      ...("paidAt" in input
        ? { paidAt: input.paidAt ? new Date(input.paidAt) : null }
        : {}),
      ...("invoiceUrl" in input
        ? { invoiceUrl: input.invoiceUrl ?? null }
        : {}),
      ...("notes" in input ? { notes: input.notes ?? null } : {}),
    });
    void logAudit({
      action: "update",
      resource: `${RESOURCE}-record`,
      resourceId: id,
      details: { ...input },
      req,
    });
    return { data: row };
  }

  async deleteBillingRecord(id: string, _actorId: string, req?: Request) {
    const existing = await itBillingRepository.findBillingRecord(id);
    if (!existing) throw new NotFoundException("Billing record not found");
    await itBillingRepository.deleteBillingRecord(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-record`,
      resourceId: id,
      req,
    });
    return { data: { id } };
  }

  // ── Alerts ──
  async listAlerts(onlyOpen: boolean) {
    const rows = await itBillingRepository.listAlerts(
      onlyOpen ? { acknowledged: false } : {},
    );
    return {
      data: rows.map((a) => ({
        id: a.id,
        subscriptionId: a.subscriptionId,
        subscription: a.subscription,
        alertType: a.alertType,
        message: a.message,
        acknowledged: a.acknowledged,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async acknowledgeAlert(id: string, actorId: string, req?: Request) {
    const row = await itBillingRepository.acknowledgeAlert(id, actorId);
    void logAudit({
      action: "acknowledge",
      resource: `${RESOURCE}-alert`,
      resourceId: id,
      req,
    });
    return { data: { id: row.id, acknowledged: row.acknowledged } };
  }

  // ── Reports (server-side roll-ups; never reduce a client page) ──
  async monthlySpendReport() {
    const subs = await itBillingRepository.activeSubscriptions();
    const byCurrency = new Map<string, number>();
    for (const s of subs) {
      const monthly = toMonthlySpend(
        Number(s.invoiceAmount),
        s.billingFrequency,
      );
      byCurrency.set(s.currency, (byCurrency.get(s.currency) ?? 0) + monthly);
    }
    return {
      data: {
        totalMonthlyByCurrency: Object.fromEntries(byCurrency),
        annualizedByCurrency: Object.fromEntries(
          [...byCurrency].map(([c, v]) => [c, v * 12]),
        ),
        subscriptionCount: subs.length,
      },
    };
  }

  /**
   * Committed spend per calendar month across a window, in one currency, with
   * what started and ended in each month.
   *
   * Reads EVERY subscription including cancelled ones — that is the whole point,
   * and it is why this does not go through `activeSubscriptions()`.
   */
  async monthlySeriesReport(query: MonthlySeriesQuery) {
    const rows = await this.monthlySubscriptions();
    const today = new Date();
    const window = resolveWindow(query, today);
    const currency = query.currency ?? pickPrimaryCurrency(rows, today);
    const series = buildMonthlySeries(rows, { ...window, currency });
    const savings = realisedSavings(rows, {
      ...window,
      currency,
      today: monthKey(today),
    });
    return {
      data: {
        ...series,
        summary: summariseSeries(series, savings),
        endedInWindow: savings.ended,
      },
    };
  }

  /**
   * The subscriptions live in one month — what a month group expands to.
   *
   * Returned whole rather than paginated: the month's subtotal has to equal the
   * sum of the rows behind it, and a total derived from one loaded page would
   * not (see the paginated-aggregates rule in CLAUDE.md).
   */
  async monthlyDetailReport(query: MonthDetailQuery) {
    const rows = await this.monthlySubscriptions();
    const currency = query.currency ?? pickPrimaryCurrency(rows, new Date());
    return { data: buildMonthDetail(rows, query.month, currency) };
  }

  private async monthlySubscriptions(): Promise<MonthlySubscription[]> {
    const rows = await itBillingRepository.subscriptionsForMonthlySeries();
    return rows.map(toMonthlySubscription);
  }

  async vendorCostReport() {
    const subs = await itBillingRepository.activeSubscriptions();
    const byVendor = new Map<
      string,
      { name: string; monthly: number; count: number }
    >();
    for (const s of subs) {
      const key = s.vendor.id;
      const cur = byVendor.get(key) ?? {
        name: s.vendor.name,
        monthly: 0,
        count: 0,
      };
      cur.monthly += toMonthlySpend(
        Number(s.invoiceAmount),
        s.billingFrequency,
      );
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

  async upcomingRenewalsReport(days = RENEWAL_SOON_DAYS) {
    if (days < 1 || days > 365) {
      throw new BadRequestException("days must be between 1 and 365");
    }
    const within = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const subs = await itBillingRepository.upcomingRenewals(within);
    return {
      data: subs.map((s) => ({
        id: s.id,
        productName: s.productName,
        vendorName: s.vendor.name,
        renewalDate: s.renewalDate?.toISOString() ?? null,
        renewalInDays: daysUntil(s.renewalDate),
        invoiceAmount: Number(s.invoiceAmount),
        currency: s.currency,
        paymentStatus: s.paymentStatus,
      })),
    };
  }

  // ── License utilization ("paid for but not used") ──
  async licenseSummary() {
    const subs = await itBillingRepository.activeSubscriptions();
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
        potentialMonthlySavingsByCurrency:
          Object.fromEntries(savingsByCurrency),
        potentialAnnualSavingsByCurrency: Object.fromEntries(
          [...savingsByCurrency].map(([c, v]) => [
            c,
            Math.round(v * 12 * 100) / 100,
          ]),
        ),
      },
    };
  }

  async licenseUtilizationReport(query: LicenseReportQuery) {
    const subs = await itBillingRepository.activeSubscriptions();
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
            monthlyCost: toMonthlySpend(
              Number(s.invoiceAmount),
              s.billingFrequency,
            ),
            ...m,
          };
        })
        // surface the biggest waste first
        .sort((a, b) => b.potentialMonthlySavings - a.potentialMonthlySavings),
    };
  }

  // ── Renewal decision workflow ──
  async recordRenewalDecision(
    id: string,
    input: RenewalDecisionInput,
    actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findSubscription(id);
    if (!existing) throw new NotFoundException("Subscription not found");
    const nextStatus = input.decision === "renew" ? "renewed" : "cancelled";
    // The date the cost STOPS, which is not the date the decision was taken.
    // Default to the renewal date because that is the paid-through date the
    // money actually follows — cancelling in August a service paid through
    // December still costs money until December. Falling back to today only
    // when there is no renewal date at all.
    //
    // A renew CLEARS it: reviving a previously cancelled subscription must undo
    // the step-down in the spend series, or the cost never reappears.
    const cancelledAt =
      input.decision === "renew"
        ? null
        : (parseDate(input.effectiveDate) ??
          existing.renewalDate ??
          new Date());
    const row = await itBillingRepository.updateSubscription(id, {
      status: nextStatus,
      renewalDecision: input.decision,
      renewalDecisionAt: new Date(),
      renewalDecisionById: actorId,
      renewalDecisionNotes: input.notes ?? null,
      cancelledAt,
      // A fresh decision re-arms the reminder ladder for the next cycle.
      remindersSent: [],
    });
    void logAudit({
      action: input.decision === "renew" ? "renew" : "cancel",
      resource: `${RESOURCE}-subscription`,
      resourceId: id,
      details: {
        decision: input.decision,
        previousStatus: existing.status,
        newStatus: nextStatus,
        notes: input.notes ?? null,
        // Recorded because it is what the spend trend reads, and because an
        // override differing from the renewal date is a judgement call someone
        // may need to justify later.
        cancelledAt: cancelledAt ? cancelledAt.toISOString() : null,
        effectiveDateOverridden: Boolean(input.effectiveDate),
      },
      req,
    });
    return { data: subscriptionDTO(row) };
  }

  async pendingRenewalDecisions() {
    const within = new Date(
      Date.now() + RENEWAL_SOON_DAYS * 24 * 60 * 60 * 1000,
    );
    const subs = await itBillingRepository.upcomingRenewals(within);
    // "Decision required" = renewal is near and no decision recorded yet.
    return {
      data: subs
        .filter((s) => !s.renewalDecision)
        .map((s) => ({
          id: s.id,
          productName: s.productName,
          vendorName: s.vendor.name,
          renewalDate: s.renewalDate?.toISOString() ?? null,
          renewalInDays: daysUntil(s.renewalDate),
          invoiceAmount: Number(s.invoiceAmount),
          currency: s.currency,
        })),
    };
  }

  // ── Document attachments (shared `uploads` bucket) ──
  async addSubscriptionAttachment(
    id: string,
    input: AddAttachmentInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findSubscription(id);
    if (!existing) throw new NotFoundException("Subscription not found");
    const next = [...readAttachments(existing.attachments), input];
    const row = await itBillingRepository.updateSubscription(id, {
      attachments: next as unknown as Prisma.InputJsonValue,
    });
    void logAudit({
      action: "attach",
      resource: `${RESOURCE}-subscription`,
      resourceId: id,
      details: { name: input.name, kind: input.kind },
      req,
    });
    return { data: subscriptionDTO(row) };
  }

  async removeSubscriptionAttachment(
    id: string,
    input: RemoveAttachmentInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findSubscription(id);
    if (!existing) throw new NotFoundException("Subscription not found");
    const next = readAttachments(existing.attachments).filter(
      (a) => a.url !== input.url,
    );
    const row = await itBillingRepository.updateSubscription(id, {
      attachments: next as unknown as Prisma.InputJsonValue,
    });
    void logAudit({
      action: "detach",
      resource: `${RESOURCE}-subscription`,
      resourceId: id,
      details: { url: input.url },
      req,
    });
    return { data: subscriptionDTO(row) };
  }

  async addVendorAttachment(
    id: string,
    input: AddAttachmentInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findVendor(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    const next = [...readAttachments(existing.attachments), input];
    const row = await itBillingRepository.updateVendor(id, {
      attachments: next as unknown as Prisma.InputJsonValue,
    });
    void logAudit({
      action: "attach",
      resource: `${RESOURCE}-vendor`,
      resourceId: id,
      details: { name: input.name, kind: input.kind },
      req,
    });
    return { data: vendorDTO(row) };
  }

  async removeVendorAttachment(
    id: string,
    input: RemoveAttachmentInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itBillingRepository.findVendor(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    const next = readAttachments(existing.attachments).filter(
      (a) => a.url !== input.url,
    );
    const row = await itBillingRepository.updateVendor(id, {
      attachments: next as unknown as Prisma.InputJsonValue,
    });
    void logAudit({
      action: "detach",
      resource: `${RESOURCE}-vendor`,
      resourceId: id,
      details: { url: input.url },
      req,
    });
    return { data: vendorDTO(row) };
  }
}

export const itBillingService = new ItBillingService();
