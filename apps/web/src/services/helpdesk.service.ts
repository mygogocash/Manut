import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Canonical option lists ─────────────────────────────

export const TICKET_CATEGORIES = [
  "account-access",
  "software-access",
  "hardware",
  "network",
  "file-drive",
  "security",
  "procurement",
  "other",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  "account-access": "Account & Access",
  "software-access": "Software Access",
  hardware: "Hardware",
  network: "Network & Connectivity",
  "file-drive": "File & Drive",
  security: "Security",
  procurement: "Procurement",
  other: "Other",
};

export const TICKET_CATEGORY_HINTS: Record<TicketCategory, string> = {
  "account-access":
    "Password reset, MFA reset, email alias, account create/deactivate, distribution-list change",
  "software-access":
    "Slack / Notion / Figma / Linear / AI Gateway access, SaaS seat, role change",
  hardware:
    "Laptop / monitor / keyboard / mouse / dock request, repair, replacement",
  network: "VPN, Wi-Fi, office network, firewall block",
  "file-drive":
    "Shared folder access, Google Drive / Supabase storage permission",
  security:
    "Phishing report, suspicious login, lost device, password compromise",
  procurement: "SaaS purchase request, hardware budget approval",
  other: "Anything else",
};

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TICKET_STATUSES = [
  "open",
  "in-progress",
  "review",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  "in-progress": "In Progress",
  review: "Review",
  resolved: "Resolved",
  closed: "Closed",
};

// ─── Types ──────────────────────────────────────────────

export interface TicketUserRef {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  department: string | null;
  jobTitle: string | null;
}

export interface TicketAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface HelpdeskTicket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  attachments: TicketAttachment[] | null;
  createdAt: string;
  updatedAt: string;
  createdBy: TicketUserRef;
  assignee: TicketUserRef | null;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  attachments?: TicketAttachment[];
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assigneeId?: string | null;
  resolutionNote?: string | null;
  attachments?: TicketAttachment[];
}

export interface ListTicketsQuery {
  scope?: "mine" | "all";
  page?: number;
  limit?: number;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assigneeId?: string;
  createdById?: string;
  q?: string;
}

// ─── API surface ────────────────────────────────────────

function toSearch(query: ListTicketsQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listTickets(
  query: ListTicketsQuery = {},
): Promise<ApiPaginatedResponse<HelpdeskTicket>> {
  return api.get(`/helpdesk${toSearch(query)}`);
}

export async function getTicket(
  id: string,
): Promise<ApiSuccessResponse<HelpdeskTicket>> {
  return api.get(`/helpdesk/${id}`);
}

export async function createTicket(
  input: CreateTicketInput,
): Promise<ApiSuccessResponse<HelpdeskTicket>> {
  return api.post("/helpdesk", input);
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
): Promise<ApiSuccessResponse<HelpdeskTicket>> {
  return api.patch(`/helpdesk/${id}`, input);
}

export async function deleteTicket(id: string): Promise<void> {
  await api.delete(`/helpdesk/${id}`);
}

export interface HelpdeskAssignee {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
}

export async function listHelpdeskAssignees(): Promise<
  ApiSuccessResponse<HelpdeskAssignee[]>
> {
  return api.get("/helpdesk/assignees");
}

export interface HelpdeskComment {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: TicketUserRef;
}

export async function listTicketComments(
  ticketId: string,
): Promise<ApiSuccessResponse<HelpdeskComment[]>> {
  return api.get(`/helpdesk/${ticketId}/comments`);
}

export async function addTicketComment(
  ticketId: string,
  body: string,
): Promise<ApiSuccessResponse<HelpdeskComment>> {
  return api.post(`/helpdesk/${ticketId}/comments`, { body });
}

export interface HelpdeskGithubSettings {
  enabled: boolean;
  repoOwner: string | null;
  repoName: string | null;
  /** True when a token is stored. The token itself never leaves the API. */
  hasToken: boolean;
  hasWebhookSecret: boolean;
  labelInProgress: string;
  labelReview: string;
}

export interface HelpdeskGithubUpdateInput {
  enabled: boolean;
  repoOwner?: string;
  repoName?: string;
  /** Leave undefined / empty to keep the stored token. */
  token?: string;
  /** Same write-only semantics as token. */
  webhookSecret?: string;
  labelInProgress?: string;
  labelReview?: string;
}

export interface HelpdeskNotificationSettings {
  notifyEmails: string[];
  notifyOnCreate: boolean;
  notifyCreatorOnCreate: boolean;
  notifyCreatorOnStatus: boolean;
  github: HelpdeskGithubSettings;
  updatedAt: string;
}

export interface HelpdeskSettingsUpdateInput {
  notifyEmails: string[];
  notifyOnCreate: boolean;
  notifyCreatorOnCreate: boolean;
  notifyCreatorOnStatus: boolean;
  github?: HelpdeskGithubUpdateInput;
}

export async function getHelpdeskSettings(): Promise<
  ApiSuccessResponse<HelpdeskNotificationSettings>
> {
  return api.get("/helpdesk/settings");
}

export async function updateHelpdeskSettings(
  input: HelpdeskSettingsUpdateInput,
): Promise<ApiSuccessResponse<HelpdeskNotificationSettings>> {
  return api.put("/helpdesk/settings", input);
}

export async function getHelpdeskInboxCount(): Promise<
  ApiSuccessResponse<{ total: number }>
> {
  return api.get("/helpdesk/inbox-count");
}
