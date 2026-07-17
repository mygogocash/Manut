import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const ANNOUNCEMENT_KINDS = [
  "policy",
  "authorized-persons",
  "handbook",
  "compliance",
  "other",
] as const;

export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export const ANNOUNCEMENT_KIND_LABELS: Record<AnnouncementKind, string> = {
  policy: "Policy",
  "authorized-persons": "Authorised persons",
  handbook: "Handbook",
  compliance: "Compliance",
  other: "Other",
};

export const ANNOUNCEMENT_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export interface AnnouncementAuthor {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface AnnouncementEntityRef {
  id: string;
  name: string;
  code: string;
}

export interface AnnouncementAttachment {
  id: string;
  announcementId: string;
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

export interface LegalAnnouncement {
  id: string;
  title: string;
  body: string;
  kind: AnnouncementKind;
  entityId: string | null;
  entity: AnnouncementEntityRef | null;
  status: AnnouncementStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  requiresAck: boolean;
  pinned: boolean;
  authorId: string;
  author: AnnouncementAuthor | null;
  attachments: AnnouncementAttachment[];
  ackCount: number;
  myAckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementListParams {
  page?: number;
  limit?: number;
  scope?: "all" | "mine";
  status?: AnnouncementStatus;
  kind?: AnnouncementKind;
  entityId?: string;
  search?: string;
  unackedOnly?: boolean;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  kind?: AnnouncementKind;
  entityId?: string;
  status?: AnnouncementStatus;
  publishedAt?: string;
  expiresAt?: string;
  requiresAck?: boolean;
  pinned?: boolean;
  attachments?: Array<{ fileUrl: string; fileName: string }>;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export interface AnnouncementAcker {
  userId: string;
  ackedAt: string;
  ackedIp: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    entity: { id: string; name: string } | null;
  } | null;
}

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

export async function listAnnouncements(
  params: AnnouncementListParams = {},
): Promise<ApiPaginatedResponse<LegalAnnouncement>> {
  return api.get(`/legal-announcements${buildQuery(params)}`);
}

export async function getAnnouncement(
  id: string,
): Promise<ApiSuccessResponse<LegalAnnouncement>> {
  return api.get(`/legal-announcements/${id}`);
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
): Promise<ApiSuccessResponse<LegalAnnouncement>> {
  return api.post("/legal-announcements", input);
}

export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput,
): Promise<ApiSuccessResponse<LegalAnnouncement>> {
  return api.put(`/legal-announcements/${id}`, input);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/legal-announcements/${id}`);
}

export async function ackAnnouncement(
  id: string,
): Promise<ApiSuccessResponse<LegalAnnouncement | null>> {
  return api.post(`/legal-announcements/${id}/ack`, {});
}

export async function listAnnouncementAckers(
  id: string,
): Promise<ApiSuccessResponse<AnnouncementAcker[]>> {
  return api.get(`/legal-announcements/${id}/acks`);
}

export async function getAnnouncementUnackedSummary(): Promise<
  ApiSuccessResponse<{ count: number }>
> {
  return api.get(`/legal-announcements/unacked-summary`);
}

export async function getAnnouncementAttachmentUrl(
  id: string,
  attachmentId: string,
): Promise<ApiSuccessResponse<{ url: string; fileName: string }>> {
  return api.get(
    `/legal-announcements/${id}/attachments/${attachmentId}/download`,
  );
}
