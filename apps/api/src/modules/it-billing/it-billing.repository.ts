import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const subscriptionInclude = {
  vendor: { select: { id: true, name: true } },
  owner: { select: userSelect },
} satisfies Prisma.ItSubscriptionInclude;

export type ItSubscriptionWithRelations = Prisma.ItSubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

export type ItVendorWithCount = Prisma.ItVendorGetPayload<{
  include: { _count: { select: { subscriptions: true } } };
}>;

export class ItBillingRepository {
  // ── Vendors ──
  listVendors() {
    return prisma.itVendor.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { name: "asc" },
    });
  }

  findVendor(id: string) {
    return prisma.itVendor.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  createVendor(data: Prisma.ItVendorUncheckedCreateInput) {
    return prisma.itVendor.create({
      data,
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  updateVendor(id: string, data: Prisma.ItVendorUncheckedUpdateInput) {
    return prisma.itVendor.update({
      where: { id },
      data,
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  deleteVendor(id: string) {
    return prisma.itVendor.delete({ where: { id } });
  }

  // ── Subscriptions ──
  listSubscriptions(args: {
    where: Prisma.ItSubscriptionWhereInput;
    skip: number;
    take: number;
  }) {
    return prisma.itSubscription.findMany({
      where: args.where,
      include: subscriptionInclude,
      orderBy: { renewalDate: "asc" },
      skip: args.skip,
      take: args.take,
    });
  }

  countSubscriptions(where: Prisma.ItSubscriptionWhereInput) {
    return prisma.itSubscription.count({ where });
  }

  findSubscription(id: string) {
    return prisma.itSubscription.findUnique({
      where: { id },
      include: subscriptionInclude,
    });
  }

  createSubscription(data: Prisma.ItSubscriptionUncheckedCreateInput) {
    return prisma.itSubscription.create({ data, include: subscriptionInclude });
  }

  updateSubscription(
    id: string,
    data: Prisma.ItSubscriptionUncheckedUpdateInput,
  ) {
    return prisma.itSubscription.update({
      where: { id },
      data,
      include: subscriptionInclude,
    });
  }

  deleteSubscription(id: string) {
    return prisma.itSubscription.delete({ where: { id } });
  }

  // ── Billing records ──
  listBillingRecords(subscriptionId: string) {
    return prisma.itBillingRecord.findMany({
      where: { subscriptionId },
      orderBy: { periodStart: "desc" },
    });
  }

  createBillingRecord(data: Prisma.ItBillingRecordUncheckedCreateInput) {
    return prisma.itBillingRecord.create({ data });
  }

  findBillingRecord(id: string) {
    return prisma.itBillingRecord.findUnique({ where: { id } });
  }

  updateBillingRecord(
    id: string,
    data: Prisma.ItBillingRecordUncheckedUpdateInput,
  ) {
    return prisma.itBillingRecord.update({ where: { id }, data });
  }

  deleteBillingRecord(id: string) {
    return prisma.itBillingRecord.delete({ where: { id } });
  }

  // ── Alerts ──
  listAlerts(where: Prisma.ItBillingAlertWhereInput = {}) {
    return prisma.itBillingAlert.findMany({
      where,
      include: { subscription: { select: { id: true, productName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createAlert(data: Prisma.ItBillingAlertUncheckedCreateInput) {
    return prisma.itBillingAlert.create({ data });
  }

  acknowledgeAlert(id: string, userId: string) {
    return prisma.itBillingAlert.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  // ── Dashboard / reporting aggregates (server-side roll-ups) ──
  activeSubscriptions() {
    return prisma.itSubscription.findMany({
      where: { status: { not: "cancelled" } },
      include: { vendor: { select: { id: true, name: true } } },
    });
  }

  countActiveSubscriptions() {
    return prisma.itSubscription.count({
      where: { status: { not: "cancelled" } },
    });
  }

  upcomingRenewals(within: Date) {
    return prisma.itSubscription.findMany({
      where: {
        status: { not: "cancelled" },
        renewalDate: { not: null, lte: within, gte: new Date() },
      },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { renewalDate: "asc" },
    });
  }

  /** Subscriptions whose renewal/payment ladder the cron should evaluate. */
  subscriptionsForReminderScan(horizon: Date) {
    return prisma.itSubscription.findMany({
      where: {
        status: { not: "cancelled" },
        OR: [
          { renewalDate: { not: null, lte: horizon } },
          { paymentStatus: { in: ["pending", "overdue"] } },
        ],
      },
      include: { owner: { select: userSelect } },
    });
  }

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });
  }
}

export const itBillingRepository = new ItBillingRepository();
