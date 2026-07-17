import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Backend list endpoints return { data, meta:{ page, limit, total } }.
export interface ItPaginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ─────────────────────────────── Billing ───────────────────────────────

export const SUBSCRIPTION_STATUSES = [
  "active",
  "expiring-soon",
  "pending-payment",
  "renewed",
  "cancelled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  "expiring-soon": "Expiring Soon",
  "pending-payment": "Pending Payment",
  renewed: "Renewed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUSES = ["paid", "pending", "overdue", "na"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BILLING_FREQUENCIES = [
  "monthly",
  "quarterly",
  "annual",
  "one-time",
] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export interface ItVendor {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  attachments: ItAttachment[];
  subscriptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  kind?: "contract" | "invoice" | "renewal" | "quotation" | "other";
}

export interface ItSubscription {
  id: string;
  vendorId: string;
  vendor: { id: string; name: string };
  category: string;
  productName: string;
  contractStartDate: string | null;
  renewalDate: string | null;
  renewalInDays: number | null;
  billingFrequency: BillingFrequency;
  invoiceAmount: number;
  monthlySpend: number;
  currency: string;
  paymentStatus: PaymentStatus;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  owner: { id: string; name: string; email: string } | null;
  ownerUserId: string | null;
  notes: string | null;
  // License utilization
  totalSeats: number | null;
  assignedSeats: number;
  activeSeats: number;
  unusedSeats: number;
  utilizationPercentage: number | null;
  potentialMonthlySavings: number;
  // Renewal decision
  renewalDecision: "renew" | "cancel" | null;
  renewalDecisionAt: string | null;
  renewalDecisionNotes: string | null;
  // Documents
  attachments: ItAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ItBillingRecord {
  id: string;
  subscriptionId: string;
  periodStart: string | null;
  periodEnd: string | null;
  amount: number;
  currency: string;
  paymentStatus: "paid" | "pending" | "overdue";
  paidAt: string | null;
  invoiceUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ItBillingAlert {
  id: string;
  subscriptionId: string;
  subscription: { id: string; productName: string };
  alertType: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface VendorInput {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface SubscriptionInput {
  vendorId: string;
  category?: string;
  productName: string;
  contractStartDate?: string | null;
  renewalDate?: string | null;
  billingFrequency?: BillingFrequency;
  invoiceAmount?: number;
  currency?: string;
  paymentStatus?: PaymentStatus;
  status?: SubscriptionStatus;
  ownerUserId?: string | null;
  notes?: string | null;
  totalSeats?: number | null;
  assignedSeats?: number;
  activeSeats?: number;
}

export function listVendors(): Promise<ApiSuccessResponse<ItVendor[]>> {
  return api.get("/it-billing/vendors");
}
export function createVendor(input: VendorInput) {
  return api.post<ApiSuccessResponse<ItVendor>>("/it-billing/vendors", input);
}
export function updateVendor(id: string, input: Partial<VendorInput>) {
  return api.patch<ApiSuccessResponse<ItVendor>>(
    `/it-billing/vendors/${id}`,
    input,
  );
}
export function deleteVendor(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/it-billing/vendors/${id}`,
  );
}

export function listSubscriptions(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubscriptionStatus;
  paymentStatus?: PaymentStatus;
  vendorId?: string;
}): Promise<ItPaginated<ItSubscription>> {
  return api.get(`/it-billing/subscriptions${qs(query)}`);
}
export function getSubscription(id: string) {
  return api.get<ApiSuccessResponse<ItSubscription>>(
    `/it-billing/subscriptions/${id}`,
  );
}
export function createSubscription(input: SubscriptionInput) {
  return api.post<ApiSuccessResponse<ItSubscription>>(
    "/it-billing/subscriptions",
    input,
  );
}
export function updateSubscription(
  id: string,
  input: Partial<SubscriptionInput>,
) {
  return api.patch<ApiSuccessResponse<ItSubscription>>(
    `/it-billing/subscriptions/${id}`,
    input,
  );
}
export function deleteSubscription(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/it-billing/subscriptions/${id}`,
  );
}

export function listBillingRecords(subscriptionId: string) {
  return api.get<ApiSuccessResponse<ItBillingRecord[]>>(
    `/it-billing/subscriptions/${subscriptionId}/records`,
  );
}
export function createBillingRecord(
  subscriptionId: string,
  input: {
    periodStart?: string | null;
    periodEnd?: string | null;
    amount?: number;
    currency?: string;
    paymentStatus?: "paid" | "pending" | "overdue";
    invoiceUrl?: string | null;
    notes?: string | null;
  },
) {
  return api.post<ApiSuccessResponse<ItBillingRecord>>(
    `/it-billing/subscriptions/${subscriptionId}/records`,
    input,
  );
}

export function listBillingAlerts(onlyOpen = true) {
  return api.get<ApiSuccessResponse<ItBillingAlert[]>>(
    `/it-billing/alerts${qs({ open: onlyOpen ? "true" : undefined })}`,
  );
}
export function acknowledgeAlert(id: string) {
  return api.post<ApiSuccessResponse<{ id: string }>>(
    `/it-billing/alerts/${id}/acknowledge`,
  );
}

export interface VendorCostRow {
  vendorId: string;
  vendorName: string;
  monthlySpend: number;
  annualSpend: number;
  subscriptionCount: number;
}
export function vendorCostReport() {
  return api.get<ApiSuccessResponse<VendorCostRow[]>>(
    "/it-billing/reports/vendor-cost",
  );
}
export function monthlySpendReport() {
  return api.get<
    ApiSuccessResponse<{
      totalMonthlyByCurrency: Record<string, number>;
      annualizedByCurrency: Record<string, number>;
      subscriptionCount: number;
    }>
  >("/it-billing/reports/monthly-spend");
}

// ── License utilization ──
export interface LicenseUtilizationRow {
  id: string;
  productName: string;
  vendorName: string;
  category: string;
  status: SubscriptionStatus;
  currency: string;
  monthlyCost: number;
  totalSeats: number | null;
  assignedSeats: number;
  activeSeats: number;
  unusedSeats: number;
  utilizationPercentage: number | null;
  potentialMonthlySavings: number;
}
export function licenseUtilizationReport(query: {
  vendorId?: string;
  category?: string;
  status?: SubscriptionStatus;
}) {
  return api.get<ApiSuccessResponse<LicenseUtilizationRow[]>>(
    `/it-billing/reports/license-utilization${qs(query)}`,
  );
}

// ── Renewal decision ──
export function recordRenewalDecision(
  id: string,
  input: { decision: "renew" | "cancel"; notes?: string },
) {
  return api.post<ApiSuccessResponse<ItSubscription>>(
    `/it-billing/subscriptions/${id}/renewal-decision`,
    input,
  );
}
export function pendingRenewalDecisions() {
  return api.get<
    ApiSuccessResponse<
      Array<{
        id: string;
        productName: string;
        vendorName: string;
        renewalDate: string | null;
        renewalInDays: number | null;
        invoiceAmount: number;
        currency: string;
      }>
    >
  >("/it-billing/renewal-decisions/pending");
}

// ── Document attachments ──
export function addSubscriptionAttachment(id: string, input: ItAttachment) {
  return api.post<ApiSuccessResponse<ItSubscription>>(
    `/it-billing/subscriptions/${id}/attachments`,
    input,
  );
}
export function removeSubscriptionAttachment(id: string, url: string) {
  return api.delete<ApiSuccessResponse<ItSubscription>>(
    `/it-billing/subscriptions/${id}/attachments${qs({ url })}`,
  );
}
export function addVendorAttachment(id: string, input: ItAttachment) {
  return api.post<ApiSuccessResponse<ItVendor>>(
    `/it-billing/vendors/${id}/attachments`,
    input,
  );
}
export function removeVendorAttachment(id: string, url: string) {
  return api.delete<ApiSuccessResponse<ItVendor>>(
    `/it-billing/vendors/${id}/attachments${qs({ url })}`,
  );
}

// ──────────────────────────── Access Mgmt ─────────────────────────────

export const ACCESS_REQUEST_TYPES = [
  "new",
  "modify",
  "revoke",
  "temporary",
  "emergency",
] as const;
export type AccessRequestType = (typeof ACCESS_REQUEST_TYPES)[number];

export const ACCESS_REQUEST_TYPE_LABELS: Record<AccessRequestType, string> = {
  new: "New Access",
  modify: "Modify Access",
  revoke: "Revoke Access",
  temporary: "Temporary Access",
  emergency: "Emergency Access",
};

export const ACCESS_REQUEST_STATUSES = [
  "draft",
  "pending-manager",
  "pending-it",
  "approved",
  "rejected",
  "granted",
  "revoked",
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const ACCESS_STATUS_LABELS: Record<AccessRequestStatus, string> = {
  draft: "Draft",
  "pending-manager": "Pending Manager Approval",
  "pending-it": "Pending IT Approval",
  approved: "Approved",
  rejected: "Rejected",
  granted: "Granted",
  revoked: "Revoked",
};

export interface ItSystem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AccessDecision {
  order: number;
  name: string;
  approverType: string;
  approverUser: { id: string; name: string; email: string } | null;
  status: string;
  decidedBy: { id: string; name: string; email: string } | null;
  decidedAt: string | null;
  notes: string | null;
}

export interface AccessRequest {
  id: string;
  requestNumber: number;
  employeeId: string;
  employee: { id: string; name: string; email: string };
  systemId: string;
  system: { id: string; name: string; category: string | null };
  requestType: AccessRequestType;
  requestedAccessLevel: string;
  businessJustification: string;
  startDate: string | null;
  endDate: string | null;
  status: AccessRequestStatus;
  currentStepOrder: number | null;
  managerComments: string | null;
  itComments: string | null;
  rejectReason: string | null;
  submittedAt: string | null;
  grantedBy: { id: string; name: string } | null;
  grantedAt: string | null;
  approvalChain: AccessDecision[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessAssignment {
  id: string;
  requestId: string | null;
  employeeId: string;
  employee: { id: string; name: string; email: string };
  systemId: string;
  system: { id: string; name: string; category: string | null };
  accessLevel: string;
  status: "active" | "revoked";
  grantedBy: { id: string; name: string };
  grantedAt: string;
  expiresAt: string | null;
  revokedBy: { id: string; name: string } | null;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface AccessAuditEntry {
  id: string;
  action: string;
  user: { id: string; name: string } | null;
  targetUser: { id: string; name: string } | null;
  requestId: string | null;
  assignmentId: string | null;
  comments: string | null;
  previousValue: unknown;
  newValue: unknown;
  createdAt: string;
}

export function listSystems(activeOnly = false) {
  return api.get<ApiSuccessResponse<ItSystem[]>>(
    `/it-access/systems${qs({ active: activeOnly ? "true" : undefined })}`,
  );
}
export function createSystem(input: {
  name: string;
  description?: string | null;
  category?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}) {
  return api.post<ApiSuccessResponse<ItSystem>>("/it-access/systems", input);
}
export function updateSystem(
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  return api.patch<ApiSuccessResponse<ItSystem>>(
    `/it-access/systems/${id}`,
    input,
  );
}
export function deleteSystem(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/it-access/systems/${id}`,
  );
}

export function listAccessRequests(query: {
  page?: number;
  limit?: number;
  scope?: "mine" | "all";
  status?: AccessRequestStatus;
  systemId?: string;
  employeeId?: string;
}): Promise<ItPaginated<AccessRequest>> {
  return api.get(`/it-access/requests${qs(query)}`);
}
export function getAccessRequest(id: string) {
  return api.get<ApiSuccessResponse<AccessRequest>>(
    `/it-access/requests/${id}`,
  );
}
export function createAccessRequest(input: {
  systemId: string;
  requestType?: AccessRequestType;
  requestedAccessLevel: string;
  businessJustification: string;
  startDate?: string | null;
  endDate?: string | null;
  employeeId?: string;
}) {
  return api.post<ApiSuccessResponse<AccessRequest>>(
    "/it-access/requests",
    input,
  );
}
export function submitAccessRequest(id: string) {
  return api.post<ApiSuccessResponse<AccessRequest>>(
    `/it-access/requests/${id}/submit`,
  );
}
export function approveAccessRequest(id: string, notes?: string) {
  return api.post<ApiSuccessResponse<AccessRequest>>(
    `/it-access/requests/${id}/approve`,
    { notes },
  );
}
export function rejectAccessRequest(id: string, reason: string) {
  return api.post<ApiSuccessResponse<AccessRequest>>(
    `/it-access/requests/${id}/reject`,
    { reason },
  );
}
export function grantAccessRequest(
  id: string,
  input: { accessLevel?: string; notes?: string } = {},
) {
  return api.post<ApiSuccessResponse<AccessRequest>>(
    `/it-access/requests/${id}/grant`,
    input,
  );
}
export function deleteAccessRequest(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/it-access/requests/${id}`,
  );
}

export function listAssignments(query: {
  employeeId?: string;
  systemId?: string;
  status?: "active" | "revoked";
}) {
  return api.get<ApiSuccessResponse<AccessAssignment[]>>(
    `/it-access/assignments${qs(query)}`,
  );
}
export function revokeAssignment(id: string, reason: string) {
  return api.post<ApiSuccessResponse<AccessAssignment>>(
    `/it-access/assignments/${id}/revoke`,
    { reason },
  );
}
export function offboardEmployee(employeeId: string, reason: string) {
  return api.post<ApiSuccessResponse<{ revokedCount: number }>>(
    `/it-access/offboarding/${employeeId}`,
    { reason },
  );
}
export function listAccessAudit(query: {
  requestId?: string;
  targetUserId?: string;
}) {
  return api.get<ApiSuccessResponse<AccessAuditEntry[]>>(
    `/it-access/audit${qs(query)}`,
  );
}

// ──────────────────────────── Dashboard ───────────────────────────────

export interface ItOpsDashboard {
  cards: {
    monthlySpendByCurrency: Record<string, number>;
    primaryCurrency: string;
    upcomingRenewals7: number;
    activeSubscriptions: number;
    pendingAccessRequests: number;
    totalLicenses: number;
    assignedLicenses: number;
    unusedLicenses: number;
    potentialMonthlySavingsByCurrency: Record<string, number>;
  };
  recentGrantedAccess: Array<{
    id: string;
    employee: { id: string; name: string };
    system: { id: string; name: string };
    accessLevel: string;
    grantedAt: string;
  }>;
  recentRevokedAccess: Array<{
    id: string;
    employee: { id: string; name: string };
    system: { id: string; name: string };
    revokedAt: string | null;
  }>;
  charts: {
    spendTrend: Array<{ month: string; amount: number }>;
    vendorBreakdown: Array<{
      vendorId: string;
      vendorName: string;
      monthlySpend: number;
    }>;
  };
  tables: {
    upcomingRenewals: Array<{
      id: string;
      productName: string;
      vendorName: string;
      renewalDate: string | null;
      renewalInDays: number | null;
      invoiceAmount: number;
      currency: string;
    }>;
    pendingAccessRequests: Array<{
      id: string;
      requestNumber: number;
      employee: { id: string; name: string };
      system: { id: string; name: string };
      requestType: string;
      status: string;
      submittedAt: string | null;
    }>;
  };
  networkCheckup: Array<{
    key: string;
    label: string;
    value: string;
    hint: string;
  }>;
}

export function getItOpsDashboard() {
  return api.get<ApiSuccessResponse<ItOpsDashboard>>(
    "/it-operations/dashboard",
  );
}
