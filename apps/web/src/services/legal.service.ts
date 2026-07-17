import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Constants ──────────────────────────────────────────

export const LEGAL_KINDS = [
  "license",
  "agreement",
  "nda",
  "policy",
  "other",
] as const;

export type LegalKind = (typeof LEGAL_KINDS)[number];

export const LEGAL_KIND_LABELS: Record<LegalKind, string> = {
  license: "License",
  agreement: "Agreement",
  nda: "NDA",
  policy: "Policy",
  other: "Other",
};

export const LEGAL_STATUSES = [
  "active",
  "expired",
  "archived",
  "draft",
  "signed",
] as const;

export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export const LEGAL_STATUS_LABELS: Record<LegalStatus, string> = {
  active: "Active",
  expired: "Expired",
  archived: "Archived",
  draft: "Draft",
  signed: "Signed",
};

// ─── Types ──────────────────────────────────────────────

export interface LegalDocumentOwner {
  id: string;
  name: string;
  email: string;
}

export interface LegalDocumentEntity {
  id: string;
  name: string;
}

export const LEGAL_ATTACHMENT_KINDS = [
  "addendum",
  "amendment",
  "renewal",
  "signed-pdf",
  "supplement",
  "other",
] as const;

export type LegalAttachmentKind = (typeof LEGAL_ATTACHMENT_KINDS)[number];

export const LEGAL_ATTACHMENT_KIND_LABELS: Record<LegalAttachmentKind, string> =
  {
    addendum: "Addendum",
    amendment: "Amendment",
    renewal: "Renewal",
    "signed-pdf": "Signed PDF",
    supplement: "Supplement",
    other: "Other",
  };

export interface LegalAttachmentUploader {
  id: string;
  name: string;
  email: string;
}

export interface LegalAttachment {
  id: string;
  documentId: string;
  kind: LegalAttachmentKind;
  label: string | null;
  fileUrl: string;
  fileName: string;
  effectiveDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  uploadedById: string | null;
  uploadedBy: LegalAttachmentUploader | null;
  createdAt: string;
}

export const LEGAL_VISIBILITY_VALUES = [
  "private",
  "public",
  "restricted",
] as const;
export type LegalVisibility = (typeof LEGAL_VISIBILITY_VALUES)[number];

export const LEGAL_VISIBILITY_LABELS: Record<LegalVisibility, string> = {
  private: "Private (legal team only)",
  public: "Everyone in the company",
  restricted: "Specific people, departments or groups",
};

export const LEGAL_SHARE_TYPES = ["user", "department", "group"] as const;
export type LegalShareType = (typeof LEGAL_SHARE_TYPES)[number];

export interface LegalShareUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface LegalShareGroup {
  id: string;
  name: string;
}

export interface LegalShare {
  id: string;
  documentId: string;
  type: LegalShareType;
  userId: string | null;
  department: string | null;
  groupId: string | null;
  user: LegalShareUser | null;
  group: LegalShareGroup | null;
  createdBy: { id: string; name: string; email: string } | null;
  createdAt: string;
}

// Alert categories for the configurable Legal notification settings
// (2026-06-12). A document is included in the expiry-alert digest only
// when its category's toggle is enabled.
export const ALERT_CATEGORY_OPTIONS = [
  { value: "contract_expiry", label: "Contract Expiry Tracking" },
  { value: "contract_review", label: "Contract Review" },
  { value: "initial_drafting", label: "Initial Contract Drafting" },
  { value: "licence_renewal", label: "Licence Renewal Tracking" },
  { value: "compliance_filing", label: "Compliance Filing Tracking" },
  { value: "counterparty_review", label: "Counterparty Review Tracking" },
] as const;
export type LegalAlertCategory =
  (typeof ALERT_CATEGORY_OPTIONS)[number]["value"];

export interface LegalDocument {
  id: string;
  title: string;
  kind: LegalKind;
  reference: string | null;
  parties: string[];
  owner: LegalDocumentOwner | null;
  entity: LegalDocumentEntity | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  // Latest expiry across the doc + every attachment. Drives status
  // and the cron digest — UI should prefer this over `expiryDate`.
  effectiveExpiry: string | null;
  renewalLeadDays: number;
  status: LegalStatus;
  // Same as `status` unless the row was saved active but the rolled-up
  // expiry has passed — in that case the API demotes to "expired".
  effectiveStatus: LegalStatus;
  fileUrl: string | null;
  fileName: string | null;
  folder: string | null;
  alertCategory: LegalAlertCategory | null;
  notes: string | null;
  visibility: LegalVisibility;
  attachments: LegalAttachment[];
  shares: LegalShare[];
  createdAt: string;
  updatedAt: string;
}

/** List endpoint may omit `notes` to keep payload small. */
export type LegalDocumentListItem = Omit<LegalDocument, "notes"> & {
  notes?: string | null;
};

export interface LegalStats {
  total: number;
  expiringSoon: number;
  expired: number;
  archived: number;
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface CreateLegalDocumentInput {
  title: string;
  kind: LegalKind;
  reference?: string;
  parties?: string[];
  ownerId?: string | null;
  entityId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  renewalLeadDays?: number;
  status?: LegalStatus;
  fileUrl?: string;
  fileName?: string;
  folder?: string;
  alertCategory?: LegalAlertCategory | null;
  notes?: string;
}

export type UpdateLegalDocumentInput = Partial<CreateLegalDocumentInput>;

// ── Notification settings ────────────────────────────────────
export interface LegalNotificationSettings {
  recipients: string[];
  notifyContractExpiry: boolean;
  notifyContractReview: boolean;
  notifyInitialDrafting: boolean;
  notifyLicenceRenewal: boolean;
  notifyComplianceFiling: boolean;
  notifyCounterpartyReview: boolean;
  updatedAt: string;
}

export type UpdateLegalNotificationSettingsInput = Omit<
  LegalNotificationSettings,
  "updatedAt"
>;

export async function getLegalSettings(): Promise<
  ApiSuccessResponse<LegalNotificationSettings>
> {
  return api.get("/legal/settings");
}

export async function updateLegalSettings(
  input: UpdateLegalNotificationSettingsInput,
): Promise<ApiSuccessResponse<LegalNotificationSettings>> {
  return api.put("/legal/settings", input);
}

export interface LegalListParams {
  page?: number;
  limit?: number;
  kind?: string;
  status?: string;
  entityId?: string;
  ownerId?: string;
  folder?: string;
  expiringWithinDays?: number;
  search?: string;
}

export interface LegalFolder {
  name: string | null;
  count: number;
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

export async function listLegalDocuments(
  params: LegalListParams = {},
): Promise<ApiPaginatedResponse<LegalDocumentListItem>> {
  return api.get(`/legal${buildQuery(params)}`);
}

export async function getLegalStats(): Promise<ApiSuccessResponse<LegalStats>> {
  return api.get(`/legal/stats`);
}

export async function getLegalDocument(
  id: string,
): Promise<ApiSuccessResponse<LegalDocument>> {
  return api.get(`/legal/${id}`);
}

export async function createLegalDocument(
  input: CreateLegalDocumentInput,
): Promise<ApiSuccessResponse<LegalDocument>> {
  return api.post("/legal", input);
}

export async function updateLegalDocument(
  id: string,
  input: UpdateLegalDocumentInput,
): Promise<ApiSuccessResponse<LegalDocument>> {
  return api.put(`/legal/${id}`, input);
}

export async function deleteLegalDocument(id: string): Promise<void> {
  await api.delete(`/legal/${id}`);
}

export async function getLegalDownloadUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string; fileName: string | null }>> {
  return api.get(`/legal/${id}/download`);
}

// ─── Attachments ────────────────────────────────────────

export interface CreateLegalAttachmentInput {
  kind?: LegalAttachmentKind;
  label?: string;
  fileUrl: string;
  fileName: string;
  effectiveDate?: string;
  expiryDate?: string;
  notes?: string;
}

export type UpdateLegalAttachmentInput = Partial<CreateLegalAttachmentInput>;

export async function createLegalAttachment(
  documentId: string,
  input: CreateLegalAttachmentInput,
): Promise<
  ApiSuccessResponse<{
    attachment: LegalAttachment;
    document: LegalDocument | null;
  }>
> {
  return api.post(`/legal/${documentId}/attachments`, input);
}

export async function updateLegalAttachment(
  documentId: string,
  attachmentId: string,
  input: UpdateLegalAttachmentInput,
): Promise<
  ApiSuccessResponse<{
    attachment: LegalAttachment;
    document: LegalDocument | null;
  }>
> {
  return api.put(`/legal/${documentId}/attachments/${attachmentId}`, input);
}

export async function deleteLegalAttachment(
  documentId: string,
  attachmentId: string,
): Promise<ApiSuccessResponse<{ id: string; document: LegalDocument | null }>> {
  return api.delete(`/legal/${documentId}/attachments/${attachmentId}`);
}

export async function getLegalAttachmentDownloadUrl(
  documentId: string,
  attachmentId: string,
): Promise<ApiSuccessResponse<{ url: string; fileName: string | null }>> {
  return api.get(`/legal/${documentId}/attachments/${attachmentId}/download`);
}

// ─── Sharing ────────────────────────────────────────────

export interface CreateLegalShareInput {
  type: LegalShareType;
  userId?: string;
  department?: string;
  groupId?: string;
}

export interface LegalShareOptions {
  departments: string[];
  groups: LegalShareGroup[];
}

export async function setLegalVisibility(
  documentId: string,
  visibility: LegalVisibility,
): Promise<ApiSuccessResponse<LegalDocument>> {
  return api.put(`/legal/${documentId}/visibility`, { visibility });
}

export async function listLegalShares(
  documentId: string,
): Promise<ApiSuccessResponse<LegalShare[]>> {
  return api.get(`/legal/${documentId}/shares`);
}

export async function createLegalShare(
  documentId: string,
  input: CreateLegalShareInput,
): Promise<
  ApiSuccessResponse<{ share: LegalShare; document: LegalDocument | null }>
> {
  return api.post(`/legal/${documentId}/shares`, input);
}

export async function deleteLegalShare(
  documentId: string,
  shareId: string,
): Promise<ApiSuccessResponse<{ id: string; document: LegalDocument | null }>> {
  return api.delete(`/legal/${documentId}/shares/${shareId}`);
}

export async function getLegalShareOptions(): Promise<
  ApiSuccessResponse<LegalShareOptions>
> {
  return api.get(`/legal/share-options`);
}

// ─── Shared with me ─────────────────────────────────────

export interface SharedLegalParams {
  page?: number;
  limit?: number;
  search?: string;
  kind?: string;
  status?: string;
}

export async function listSharedLegalDocuments(
  params: SharedLegalParams = {},
): Promise<ApiPaginatedResponse<LegalDocument>> {
  return api.get(`/legal/shared-with-me${buildQuery(params)}`);
}

export async function getSharedLegalDocument(
  id: string,
): Promise<ApiSuccessResponse<LegalDocument>> {
  return api.get(`/legal/shared-with-me/${id}`);
}

export async function getSharedLegalDownloadUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string; fileName: string | null }>> {
  return api.get(`/legal/shared-with-me/${id}/download`);
}

export async function getLegalFolders(): Promise<
  ApiSuccessResponse<LegalFolder[]>
> {
  return api.get("/legal/folders");
}

// ─── Signing (Phase 2) ──────────────────────────────────

export const LEGAL_SIGNATURE_STATUSES = [
  "pending",
  "sent",
  "viewed",
  "signed",
  "declined",
  "cancelled",
] as const;

export type LegalSignatureStatus = (typeof LEGAL_SIGNATURE_STATUSES)[number];

export const LEGAL_SIGNATURE_STATUS_LABELS: Record<
  LegalSignatureStatus,
  string
> = {
  pending: "Pending",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export interface LegalSignatureCreator {
  id: string;
  name: string;
  email: string;
}

export interface LegalSignature {
  id: string;
  documentId: string;
  signerEmail: string;
  signerName: string;
  status: LegalSignatureStatus;
  inviteMessage: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  signatureText: string | null;
  signatureMethod: "typed" | null;
  expiresAt: string | null;
  signingOrder: number;
  signedPdfUrl: string | null;
  createdAt: string;
  createdBy?: LegalSignatureCreator | null;
}

export interface SendForSignatureSignerInput {
  signerEmail: string;
  signerName: string;
  signingOrder: number;
}

export interface SendForSignatureInput {
  // Single-signer shape kept for backwards compatibility.
  signerEmail?: string;
  signerName?: string;
  signingOrder?: number;
  // Multi-signer shape — server picks this branch when populated.
  signers?: SendForSignatureSignerInput[];
  inviteMessage?: string;
  expiresAt?: string;
}

export async function sendDocumentForSignature(
  documentId: string,
  input: SendForSignatureInput,
): Promise<ApiSuccessResponse<LegalSignature | LegalSignature[]>> {
  return api.post(`/legal/${documentId}/signatures`, input);
}

export async function listDocumentSignatures(
  documentId: string,
): Promise<ApiSuccessResponse<LegalSignature[]>> {
  return api.get(`/legal/${documentId}/signatures`);
}

export async function cancelSignature(signatureId: string): Promise<void> {
  await api.delete(`/legal/signatures/${signatureId}`);
}
