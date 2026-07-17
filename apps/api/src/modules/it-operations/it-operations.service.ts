import { prisma } from "@/infrastructure/database/prisma";
import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";
import {
  seatMetrics,
  toMonthlySpend,
} from "@/modules/it-billing/it-billing.service";

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

    // Monthly spend trend - annualized/12 isn't time-series, so we project
    // the next 6 months at the current recurring run-rate (a stable, honest
    // baseline; real per-month variance lives in billing records).
    const monthlyTotals = monthlyByCurrency(activeSubs);
    const primaryCurrency =
      Object.entries(monthlyTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "USD";
    const runRate = monthlyTotals[primaryCurrency] ?? 0;
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const spendTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return {
        month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        amount: Math.round(runRate),
      };
    });

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
