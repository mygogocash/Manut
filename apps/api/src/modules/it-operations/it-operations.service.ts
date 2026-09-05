import { prisma } from "@/infrastructure/database/prisma";
import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";
import {
  itBillingService,
  seatMetrics,
  toMonthlySpend,
} from "@/modules/it-billing/it-billing.service";

/** Trailing months the dashboard's spend trend covers. */
const SPEND_TREND_MONTHS = 12;

type SpendRow = {
  currency: string;
  invoiceAmount: unknown;
  billingFrequency: string;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Office Network Checkup is informational only - vendor software already
 * does the monitoring. We surface static placeholder cards so the page
 * reads as "part of IT Operations" without standing up any infra.
 */
const NETWORK_CHECKUP_PLACEHOLDERS = [
  {
    key: "connectivity",
    label: "Connectivity",
    value: "Monitored by vendor",
    hint: "Uptime + latency tracked in the network vendor console",
  },
  {
    key: "firewall",
    label: "Firewall & VPN",
    value: "Monitored by vendor",
    hint: "Policy + tunnel health managed externally",
  },
  {
    key: "wifi",
    label: "Office Wi-Fi",
    value: "Monitored by vendor",
    hint: "AP health + client counts in the vendor dashboard",
  },
  {
    key: "endpoints",
    label: "Endpoint Security",
    value: "Monitored by vendor",
    hint: "Device posture handled by the MDM/EDR tool",
  },
] as const;

function monthlyByCurrency(subs: SpendRow[]) {
  const m = new Map<string, number>();
  for (const s of subs) {
    m.set(
      s.currency,
      (m.get(s.currency) ?? 0) +
        toMonthlySpend(Number(s.invoiceAmount), s.billingFrequency),
    );
  }
  return Object.fromEntries(m);
}

export class ItOperationsService {
  async dashboard() {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * DAY);
    const in30 = new Date(now.getTime() + 30 * DAY);

    const [
      activeSubs,
      activeSubCount,
      renewals7,
      renewals30,
      pendingAccess,
      recentGranted,
      recentRevoked,
      monthlySeries,
    ] = await Promise.all([
      itBillingRepository.activeSubscriptions(),
      itBillingRepository.countActiveSubscriptions(),
      itBillingRepository.upcomingRenewals(in7),
      itBillingRepository.upcomingRenewals(in30),
      prisma.itAccessRequest.findMany({
        where: { status: { in: ["pending-manager", "pending-it"] } },
        include: {
          employee: { select: { id: true, name: true } },
          system: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: "asc" },
        take: 20,
      }),
      prisma.itAccessAssignment.findMany({
        where: { status: "active" },
        include: {
          employee: { select: { id: true, name: true } },
          system: { select: { id: true, name: true } },
        },
        orderBy: { grantedAt: "desc" },
        take: 8,
      }),
      prisma.itAccessAssignment.findMany({
        where: { status: "revoked" },
        include: {
          employee: { select: { id: true, name: true } },
          system: { select: { id: true, name: true } },
        },
        orderBy: { revokedAt: "desc" },
        take: 8,
      }),
      // The SAME computation the Monthly tab renders, not a re-derivation.
      // Two surfaces reporting the same spend by different code is how they
      // came to disagree in the first place.
      itBillingService.monthlySeriesReport({ months: SPEND_TREND_MONTHS }),
    ]);

    // Vendor spend breakdown (monthly-equivalent), top 8.
    const byVendor = new Map<string, { name: string; monthly: number }>();
    for (const s of activeSubs) {
      const cur = byVendor.get(s.vendor.id) ?? {
        name: s.vendor.name,
        monthly: 0,
      };
      cur.monthly += toMonthlySpend(
        Number(s.invoiceAmount),
        s.billingFrequency,
      );
      byVendor.set(s.vendor.id, cur);
    }
    const vendorBreakdown = [...byVendor.entries()]
      .map(([vendorId, v]) => ({
        vendorId,
        vendorName: v.name,
        monthlySpend: v.monthly,
      }))
      .sort((a, b) => b.monthlySpend - a.monthlySpend)
      .slice(0, 8);

    // Run-rate for the KPI cards: "what do we pay right now", so `activeSubs`
    // (cancelled excluded) is the correct set here. This is a DIFFERENT question
    // from the trend below, which needs the cancelled rows — the old code used
    // one figure for both, which is how the chart came to hide cancellations.
    const monthlyTotals = monthlyByCurrency(activeSubs);
    const primaryCurrency =
      Object.entries(monthlyTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "USD";

    // Monthly spend trend — the real trailing series.
    //
    // This used to project the current run-rate forward six months, which made
    // it a FLAT line that could not show spend rising or falling however much it
    // moved, and it read the future rather than the past. Worse, it drew its
    // run-rate from `activeSubs`, which excludes cancelled subscriptions — so
    // cancelling a service removed it from the chart instead of showing the
    // saving.
    //
    // It now renders `monthlySeriesReport`, the same call behind the Monthly tab:
    // trailing months, cancelled rows included in the months they were live, one
    // currency. Deriving it separately here is what let the two surfaces
    // disagree about the same spend, so the trend deliberately re-uses the
    // series rather than recomputing from `activeSubs`.
    const spendTrend = monthlySeries.data.points.map((point) => ({
      month: point.month,
      label: point.label,
      amount: Math.round(point.total),
    }));
    const spendTrendCurrency = monthlySeries.data.currency;

    // License utilization KPIs ("paid for but not used").
    let totalLicenses = 0;
    let assignedLicenses = 0;
    let unusedLicenses = 0;
    const savingsByCurrency = new Map<string, number>();
    for (const s of activeSubs) {
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
        cards: {
          monthlySpendByCurrency: monthlyTotals,
          primaryCurrency,
          upcomingRenewals7: renewals7.length,
          activeSubscriptions: activeSubCount,
          pendingAccessRequests: pendingAccess.length,
          totalLicenses,
          assignedLicenses,
          unusedLicenses,
          potentialMonthlySavingsByCurrency:
            Object.fromEntries(savingsByCurrency),
        },
        recentGrantedAccess: recentGranted.map((a) => ({
          id: a.id,
          employee: a.employee,
          system: a.system,
          accessLevel: a.accessLevel,
          grantedAt: a.grantedAt.toISOString(),
        })),
        recentRevokedAccess: recentRevoked.map((a) => ({
          id: a.id,
          employee: a.employee,
          system: a.system,
          revokedAt: a.revokedAt?.toISOString() ?? null,
        })),
        charts: {
          spendTrend,
          // Named so the card can say WHICH currency it is charting — the
          // series is one currency and the KPI cards above it are not.
          spendTrendCurrency,
          vendorBreakdown,
        },
        tables: {
          upcomingRenewals: renewals30.map((s) => ({
            id: s.id,
            productName: s.productName,
            vendorName: s.vendor.name,
            renewalDate: s.renewalDate?.toISOString() ?? null,
            renewalInDays: s.renewalDate
              ? Math.ceil((s.renewalDate.getTime() - now.getTime()) / DAY)
              : null,
            invoiceAmount: Number(s.invoiceAmount),
            currency: s.currency,
          })),
          pendingAccessRequests: pendingAccess.map((r) => ({
            id: r.id,
            requestNumber: r.requestNumber,
            employee: r.employee,
            system: r.system,
            requestType: r.requestType,
            status: r.status,
            submittedAt: r.submittedAt?.toISOString() ?? null,
          })),
        },
        networkCheckup: NETWORK_CHECKUP_PLACEHOLDERS,
      },
    };
  }
}

export const itOperationsService = new ItOperationsService();
