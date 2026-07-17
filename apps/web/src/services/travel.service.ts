import { api, apiBaseUrl } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

// Canonical menus surfaced on the request form. Stored as plain strings
// on the row, but the UI uses these enums + label maps as the source of
// truth for all clients.
export const FLIGHT_TYPES = ["one_way", "round_trip", "multi_trip"] as const;
export type FlightType = (typeof FLIGHT_TYPES)[number];
export const FLIGHT_TYPE_LABELS: Record<FlightType, string> = {
  one_way: "One Way",
  round_trip: "Round Trip",
  multi_trip: "Multiple Trip",
};

export const SEATING_PREFERENCES = ["window", "aisle", "other"] as const;
export type SeatingPreference = (typeof SEATING_PREFERENCES)[number];
export const SEATING_PREFERENCE_LABELS: Record<SeatingPreference, string> = {
  window: "Window seat",
  aisle: "Aisle seat",
  other: "Other (please specify)",
};

export const HOTEL_LOCATION_PREFERENCES = [
  "near_meeting",
  "near_airport",
] as const;
export type HotelLocationPreference =
  (typeof HOTEL_LOCATION_PREFERENCES)[number];
export const HOTEL_LOCATION_PREFERENCE_LABELS: Record<
  HotelLocationPreference,
  string
> = {
  near_meeting: "Nearby meeting point",
  near_airport: "Nearby airport",
};

export interface TravelRequest {
  id: string;
  requestCode: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
  entity: { id: string; name: string } | null;
  origin: string | null;
  destination: string;
  purpose: string;
  departureDate: string;
  returnDate: string;
  estimatedBudget: string | null;
  cashAdvance: string | null;
  currency: string;
  category: TravelCategory;
  flightType: FlightType | null;
  departureTimePreference: string | null;
  returnTimePreference: string | null;
  mealPreference: string | null;
  seatingPreference: SeatingPreference | null;
  seatingPreferenceOther: string | null;
  dummyTicketRequired: boolean;
  visaRequired: boolean;
  hotelRequired: boolean;
  hotelLocationPreference: HotelLocationPreference | null;
  preferredHotel: string | null;
  hotelDetails: string | null;
  notes: string | null;
  status:
    | "draft"
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "completed"
    | "archived";
  approver: { id: string; name: string; email: string } | null;
  approvedAt: string | null;
  rejectReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  // Server-computed: true when the requesting user may approve/reject
  // the current step (designated chain approver, manager fallback, or
  // HR holder of travel:hr-approve).
  viewerCanAct: boolean;
  expenses?: Array<{
    id: string;
    description: string;
    amount: string;
    currency: string;
    status: string;
    date: string;
  }>;
}

export interface TravelLinkedExpense {
  id: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  date: string;
}

export interface CreateTravelRequestInput {
  origin: string;
  destination: string;
  purpose: string;
  departureDate: string;
  returnDate: string;
  estimatedBudget?: number;
  cashAdvance?: number;
  currency?: string;
  category?: TravelCategory;
  flightType?: FlightType;
  departureTimePreference?: string;
  returnTimePreference?: string;
  mealPreference?: string;
  seatingPreference?: SeatingPreference;
  seatingPreferenceOther?: string;
  dummyTicketRequired?: boolean;
  visaRequired?: boolean;
  hotelRequired?: boolean;
  hotelLocationPreference?: HotelLocationPreference;
  preferredHotel?: string;
  hotelDetails?: string;
  notes?: string;
}

export interface UpdateTravelRequestInput {
  origin?: string;
  destination?: string;
  purpose?: string;
  departureDate?: string;
  returnDate?: string;
  estimatedBudget?: number;
  cashAdvance?: number;
  currency?: string;
  category?: TravelCategory;
  flightType?: FlightType;
  departureTimePreference?: string;
  returnTimePreference?: string;
  mealPreference?: string;
  seatingPreference?: SeatingPreference;
  seatingPreferenceOther?: string;
  dummyTicketRequired?: boolean;
  visaRequired?: boolean;
  hotelRequired?: boolean;
  hotelLocationPreference?: HotelLocationPreference;
  preferredHotel?: string;
  hotelDetails?: string;
  notes?: string;
}

export type TravelApproverType = "manager" | "manager_l2" | "user";

export interface TravelApprovalStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverType: TravelApproverType;
  approverUserId: string | null;
  approverUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  // Submitter ids for whom this step is skipped entirely.
  skipWhenSubmitterIds: string[];
  // Submitter ids for whom this step is the only one that fires.
  // When non-empty, every other submitter skips this step.
  onlyWhenSubmitterIds: string[];
  // Categories this step applies to (empty = all categories).
  categoryFilter: TravelCategory[];
  // THB-equivalent amount band — Decimal serialises as string.
  amountMinBaht: string | null;
  amountMaxBaht: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TRAVEL_CATEGORIES = ["general", "business_or_bd"] as const;
export type TravelCategory = (typeof TRAVEL_CATEGORIES)[number];
export const TRAVEL_CATEGORY_LABEL: Record<TravelCategory, string> = {
  general: "General",
  business_or_bd: "Business travel / BD",
};

export interface TravelApprovalDecision {
  id: string;
  travelRequestId: string;
  order: number;
  name: string;
  approverType: TravelApproverType;
  approverUserId: string | null;
  approverUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: "pending" | "approved" | "rejected" | "skipped";
  decidedById: string | null;
  decidedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  decidedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateTravelApprovalStepInput {
  name: string;
  description?: string;
  approverType: TravelApproverType;
  approverUserId?: string | null;
  skipWhenSubmitterIds?: string[];
  onlyWhenSubmitterIds?: string[];
  categoryFilter?: TravelCategory[];
  amountMinBaht?: number | null;
  amountMaxBaht?: number | null;
  isActive: boolean;
}

export type UpdateTravelApprovalStepInput =
  Partial<CreateTravelApprovalStepInput>;

export interface TravelRequestParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  entityId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ─── Helpers ────────────────────────────────────────────

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─── Service ────────────────────────────────────────────

export async function listTravelRequests(
  params: TravelRequestParams = {},
): Promise<ApiPaginatedResponse<TravelRequest>> {
  return api.get(`/travel/requests${buildQuery(params)}`);
}

export async function getTravelRequest(
  id: string,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.get(`/travel/requests/${id}`);
}

export async function createTravelRequest(
  input: CreateTravelRequestInput,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.post("/travel/requests", input);
}

export async function updateTravelRequest(
  id: string,
  input: UpdateTravelRequestInput,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.put(`/travel/requests/${id}`, input);
}

export async function approveTravelRequest(
  id: string,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.put(`/travel/requests/${id}/approve`);
}

export async function rejectTravelRequest(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.put(`/travel/requests/${id}/reject`, { reason });
}

export async function cancelTravelRequest(
  id: string,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.put(`/travel/requests/${id}/cancel`);
}

export async function deleteTravelRequest(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean; id: string }>> {
  return api.delete(`/travel/requests/${id}`);
}

export async function completeTravelRequest(
  id: string,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.put(`/travel/requests/${id}/complete`);
}

export async function archiveTravelRequest(
  id: string,
): Promise<ApiSuccessResponse<TravelRequest>> {
  return api.put(`/travel/requests/${id}/archive`);
}

export async function listLinkedExpenses(
  travelRequestId: string,
): Promise<ApiSuccessResponse<TravelLinkedExpense[]>> {
  return api.get(`/travel/requests/${travelRequestId}/expenses`);
}

export function getTravelExportUrl(params: TravelRequestParams = {}): string {
  return `${apiBaseUrl}/travel/export${buildQuery(params)}`;
}

export async function listTravelApprovalSteps(): Promise<
  ApiSuccessResponse<TravelApprovalStep[]>
> {
  return api.get("/travel/approval-steps");
}

export async function createTravelApprovalStep(
  input: CreateTravelApprovalStepInput,
): Promise<ApiSuccessResponse<TravelApprovalStep>> {
  return api.post("/travel/approval-steps", input);
}

export async function updateTravelApprovalStep(
  id: string,
  input: UpdateTravelApprovalStepInput,
): Promise<ApiSuccessResponse<TravelApprovalStep>> {
  return api.put(`/travel/approval-steps/${id}`, input);
}

export async function deleteTravelApprovalStep(
  id: string,
): Promise<ApiSuccessResponse<TravelApprovalStep>> {
  return api.delete(`/travel/approval-steps/${id}`);
}

export async function reorderTravelApprovalSteps(
  orderedIds: string[],
): Promise<ApiSuccessResponse<TravelApprovalStep[]>> {
  return api.put("/travel/approval-steps/reorder", { orderedIds });
}

export interface TravelNotificationRecipients {
  emails: string[];
}

export async function getTravelNotificationRecipients(): Promise<
  ApiSuccessResponse<TravelNotificationRecipients>
> {
  return api.get("/travel/notification-recipients");
}

export async function setTravelNotificationRecipients(
  emails: string[],
): Promise<ApiSuccessResponse<TravelNotificationRecipients>> {
  return api.put("/travel/notification-recipients", { emails });
}

export async function getTravelApprovals(
  travelRequestId: string,
): Promise<ApiSuccessResponse<TravelApprovalDecision[]>> {
  return api.get(`/travel/requests/${travelRequestId}/approvals`);
}

export async function downloadTravelExport(
  params: TravelRequestParams = {},
): Promise<void> {
  const res = await fetch(getTravelExportUrl(params), {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ?? "Export failed");
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `travel-requests-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
