import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface IntegrationStatus {
  configured: boolean;
  status: "connected" | "not_configured";
}

export interface GoogleConnectionStatus {
  connected: boolean;
  accountEmail?: string;
  expiresAt?: string;
  scope?: string;
  /** False when the stored token only has gmail.readonly (reconnect required). */
  canSendMail?: boolean;
}

export interface IntegrationsStatus {
  anthropic: IntegrationStatus;
  gmail: IntegrationStatus;
  drive: IntegrationStatus;
  google: GoogleConnectionStatus;
}

export interface GmailListItem {
  id?: string;
  messageId?: string;
  threadId?: string;
  from?: string;
  sender?: string;
  to?: string;
  subject?: string;
  snippet?: string;
  preview?: string;
  // Gmail's labelIds on the message — used to render star / unread
  // badges + Important markers per row. Empty array when none.
  labelIds?: string[];
  date?: string;
}

export interface DriveFile {
  id?: string;
  name?: string;
  type?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  modified?: string;
  webViewLink?: string;
  shared?: boolean;
}

// System Gmail folders the sidebar surfaces. Mirrors the BE
// `GmailFolder` union — keep them in sync.
export type GmailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "starred"
  | "important"
  | "snoozed"
  | "spam"
  | "trash";

export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesUnread?: number;
  messagesTotal?: number;
}

export interface GmailLabelsResponse {
  system: GmailLabel[];
  user: GmailLabel[];
}

interface ListResp<T> {
  data: T[];
  raw?: string;
  nextPageToken?: string | null;
}

// ─── Service ────────────────────────────────────────────

export function getIntegrationsStatus() {
  return api.get<ApiSuccessResponse<IntegrationsStatus>>(
    "/integrations/status",
  );
}

export async function startGoogleOauth(): Promise<{ url: string }> {
  const res = await api.get<ApiSuccessResponse<{ url: string }>>(
    "/integrations/google/oauth-start",
  );
  return { url: res.data.url };
}

export async function disconnectGoogle(): Promise<{ ok: boolean }> {
  const res = await api.delete<ApiSuccessResponse<{ ok: boolean }>>(
    "/integrations/google",
  );
  return { ok: res.data.ok };
}

export function listGmail(
  folderOrLabel: GmailFolder | { labelId: string },
  opts?: { pageToken?: string; pageSize?: number },
) {
  const payload: Record<string, unknown> = {
    pageToken: opts?.pageToken,
    pageSize: opts?.pageSize,
  };
  if (typeof folderOrLabel === "string") {
    payload.folder = folderOrLabel;
  } else {
    payload.labelId = folderOrLabel.labelId;
  }
  return api.post<ListResp<GmailListItem>>("/integrations/gmail/list", payload);
}

export function listGmailLabels() {
  return api.get<ApiSuccessResponse<GmailLabelsResponse>>(
    "/integrations/gmail/labels",
  );
}

export function modifyGmail(
  messageId: string,
  opts: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  return api.post<ApiSuccessResponse<{ id: string; labelIds: string[] }>>(
    "/integrations/gmail/modify",
    { messageId, ...opts },
  );
}

export function trashGmail(messageId: string) {
  return api.post<ApiSuccessResponse<{ id: string; labelIds: string[] }>>(
    "/integrations/gmail/trash",
    { messageId },
  );
}

export function untrashGmail(messageId: string) {
  return api.post<ApiSuccessResponse<{ id: string; labelIds: string[] }>>(
    "/integrations/gmail/untrash",
    { messageId },
  );
}

export interface GmailMessage {
  messageId: string;
  threadId: string;
  rfcMessageId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
}

export interface GmailAttachmentInput {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface GmailSendInput {
  to: string;
  cc?: string;
  subject: string;
  body?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: GmailAttachmentInput[];
}

export function readGmail(messageId: string) {
  return api.post<ApiSuccessResponse<GmailMessage>>(
    "/integrations/gmail/read",
    { messageId },
  );
}

export function sendGmail(input: GmailSendInput) {
  return api.post<ApiSuccessResponse<{ result: string }>>(
    "/integrations/gmail/send",
    input,
  );
}

export function listDrive(
  query?: string,
  opts?: { pageToken?: string; pageSize?: number },
) {
  return api.post<ListResp<DriveFile>>("/integrations/drive/list", {
    query,
    pageToken: opts?.pageToken,
    pageSize: opts?.pageSize,
  });
}
