import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

// Dashboard foundation keeps KPI cards only — strips recent access rows
// and charts that may embed employee identity.
const dashboardCardsApiSchema = z
  .object({
    monthlySpendByCurrency: z.record(z.string(), z.number()).optional(),
    primaryCurrency: z.string().optional(),
    upcomingRenewals7: z.number().int().nonnegative(),
    activeSubscriptions: z.number().int().nonnegative(),
    pendingAccessRequests: z.number().int().nonnegative(),
    totalLicenses: z.number().int().nonnegative(),
    assignedLicenses: z.number().int().nonnegative(),
    unusedLicenses: z.number().int().nonnegative(),
  })
  .passthrough();

const dashboardApiSchema = z
  .object({
    cards: dashboardCardsApiSchema,
  })
  .passthrough();

export const itOpsDashboardSchema = dashboardApiSchema.transform((row) => ({
  upcomingRenewals7: row.cards.upcomingRenewals7,
  activeSubscriptions: row.cards.activeSubscriptions,
  pendingAccessRequests: row.cards.pendingAccessRequests,
  totalLicenses: row.cards.totalLicenses,
  assignedLicenses: row.cards.assignedLicenses,
  unusedLicenses: row.cards.unusedLicenses,
  primaryCurrency: row.cards.primaryCurrency ?? "USD",
  monthlySpendByCurrency: row.cards.monthlySpendByCurrency ?? {},
}));

const dashboardResponseSchema = z
  .object({
    data: itOpsDashboardSchema,
  })
  .strict();

export type ItOpsDashboard = z.infer<typeof itOpsDashboardSchema>;

export const IT_OPS_DASHBOARD_QUERY_KEY = [
  "it-operations",
  "dashboard",
] as const;

export function itOpsDashboardQueryKey() {
  return IT_OPS_DASHBOARD_QUERY_KEY;
}

export async function getItOpsDashboard(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<ItOpsDashboard> {
  const response = await client.get<unknown>(
    "/it-operations/dashboard",
    signal ? { signal } : undefined,
  );
  return dashboardResponseSchema.parse(response).data;
}

export const accessRequestStatusSchema = z.enum([
  "draft",
  "pending-manager",
  "pending-it",
  "approved",
  "rejected",
  "granted",
  "revoked",
]);

const accessRequestApiSchema = z
  .object({
    id: z.string().min(1),
    requestNumber: z.number().int().nonnegative(),
    status: accessRequestStatusSchema,
    requestedAccessLevel: z.string().min(1),
    system: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
    employee: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().optional(),
      })
      .passthrough(),
    businessJustification: z.string().optional(),
  })
  .passthrough();

export const accessRequestSchema = accessRequestApiSchema.transform((row) => ({
  id: row.id,
  requestNumber: row.requestNumber,
  status: row.status,
  requestedAccessLevel: row.requestedAccessLevel,
  systemName: row.system.name,
  employeeName: row.employee.name,
}));

const accessRequestListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

const accessRequestListResponseSchema = z
  .object({
    data: z.array(accessRequestSchema),
    meta: z
      .object({
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .strict();

export type AccessRequest = z.infer<typeof accessRequestSchema>;
export type AccessRequestList = z.infer<typeof accessRequestListResponseSchema>;
export type AccessRequestListParams = z.input<
  typeof accessRequestListParamsSchema
>;
export type AccessRequestStatus = z.infer<typeof accessRequestStatusSchema>;

export const IT_ACCESS_REQUESTS_QUERY_ROOT = [
  "it-access",
  "requests",
] as const;

export function itAccessRequestsQueryKey(
  params: AccessRequestListParams = {},
) {
  return [
    ...IT_ACCESS_REQUESTS_QUERY_ROOT,
    accessRequestListParamsSchema.parse(params),
  ] as const;
}

export async function listAccessRequests(
  client: ApiClient,
  params: AccessRequestListParams = {},
  signal?: RequestAbortSignal,
): Promise<AccessRequestList> {
  const parsed = accessRequestListParamsSchema.parse(params);
  const query = `page=${parsed.page}&limit=${parsed.limit}`;
  const response = await client.get<unknown>(
    `/it-access/requests?${query}`,
    signal ? { signal } : undefined,
  );
  return accessRequestListResponseSchema.parse(response);
}

const subscriptionStatusSchema = z.enum([
  "active",
  "expiring-soon",
  "pending-payment",
  "renewed",
  "cancelled",
]);

const subscriptionApiSchema = z
  .object({
    id: z.string().min(1),
    productName: z.string().min(1),
    status: subscriptionStatusSchema,
    effectiveStatus: subscriptionStatusSchema.optional(),
    currency: z.string().min(1),
    monthlySpend: z.number(),
    renewalDate: nullableText.optional(),
    vendor: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const itSubscriptionSchema = subscriptionApiSchema.transform((row) => ({
  id: row.id,
  productName: row.productName,
  status: row.effectiveStatus ?? row.status,
  currency: row.currency,
  monthlySpend: row.monthlySpend,
  renewalDate: row.renewalDate ?? null,
  vendorName: row.vendor.name,
}));

const subscriptionListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

const subscriptionListResponseSchema = z
  .object({
    data: z.array(itSubscriptionSchema),
    meta: z
      .object({
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .strict();

export type ItSubscription = z.infer<typeof itSubscriptionSchema>;
export type ItSubscriptionList = z.infer<typeof subscriptionListResponseSchema>;
export type ItSubscriptionListParams = z.input<
  typeof subscriptionListParamsSchema
>;

export const IT_BILLING_SUBSCRIPTIONS_QUERY_ROOT = [
  "it-billing",
  "subscriptions",
] as const;

export function itBillingSubscriptionsQueryKey(
  params: ItSubscriptionListParams = {},
) {
  return [
    ...IT_BILLING_SUBSCRIPTIONS_QUERY_ROOT,
    subscriptionListParamsSchema.parse(params),
  ] as const;
}

export async function listItSubscriptions(
  client: ApiClient,
  params: ItSubscriptionListParams = {},
  signal?: RequestAbortSignal,
): Promise<ItSubscriptionList> {
  const parsed = subscriptionListParamsSchema.parse(params);
  const query = `page=${parsed.page}&limit=${parsed.limit}`;
  const response = await client.get<unknown>(
    `/it-billing/subscriptions?${query}`,
    signal ? { signal } : undefined,
  );
  return subscriptionListResponseSchema.parse(response);
}
