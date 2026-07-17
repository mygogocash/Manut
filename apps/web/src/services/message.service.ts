import { api } from "@/lib/api-client";
import { trackMessageSent } from "@/lib/events";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface ChannelCreator {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  members: string[] | null;
  type: "channel" | "dm";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: ChannelCreator;
  _count: { messages: number };
  unreadCount?: number;
}

export interface MessageableUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface MessageAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  bucket: string | null;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: MessageAuthor;
  attachments?: MessageAttachment[];
  readBy?: string[];
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
  members?: string[];
}

export interface UpdateChannelInput {
  name?: string;
  description?: string | null;
}

export interface SendMessageInput {
  content: string;
  attachmentIds?: string[];
}

// ─── Channels ───────────────────────────────────────────

export function getChannels() {
  return api.get<{ data: Channel[] }>("/messages/channels");
}

export function getMessagesUnreadCount() {
  return api.get<{ data: { total: number } }>("/messages/unread-count");
}

export function getChannel(id: string) {
  return api.get<ApiSuccessResponse<Channel>>(`/messages/channels/${id}`);
}

export function createChannel(data: CreateChannelInput) {
  return api.post<ApiSuccessResponse<Channel>>("/messages/channels", data);
}

export function updateChannel(id: string, data: UpdateChannelInput) {
  return api.put<ApiSuccessResponse<Channel>>(`/messages/channels/${id}`, data);
}

export function deleteChannel(id: string) {
  return api.delete<ApiSuccessResponse<{ success: boolean }>>(
    `/messages/channels/${id}`,
  );
}

export function hideConversation(id: string) {
  return api.post<
    ApiSuccessResponse<{ hidden: boolean; hardDeleted: boolean }>
  >(`/messages/channels/${id}/hide`, {});
}

// ─── Messages ───────────────────────────────────────────

export function getMessages(
  channelId: string,
  params?: { page?: number; limit?: number },
) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return api.get<ApiPaginatedResponse<Message>>(
    `/messages/channels/${channelId}/messages${query ? `?${query}` : ""}`,
  );
}

export async function sendMessage(channelId: string, data: SendMessageInput) {
  const response = await api.post<ApiSuccessResponse<Message>>(
    `/messages/channels/${channelId}/messages`,
    data,
  );
  // thread_type defaults to "channel" — DMs route through createDirectMessage
  // first then sendMessage, so by the time we get here we genuinely don't
  // know whether the channel is direct or group without a lookup. Coarse
  // labelling is acceptable for v1.
  trackMessageSent({
    thread_type: "channel",
    has_attachment: (data.attachmentIds?.length ?? 0) > 0,
    char_count: data.content.length,
  });
  return response;
}

export function deleteMessage(channelId: string, messageId: string) {
  return api.delete<ApiSuccessResponse<Message>>(
    `/messages/channels/${channelId}/messages/${messageId}`,
  );
}

// ─── Direct Messages ────────────────────────────────────

export function createDirectMessage(userIds: string[]) {
  return api.post<ApiSuccessResponse<Channel>>("/messages/dms", { userIds });
}

export function getMessageableUsers() {
  return api.get<{ data: MessageableUser[] }>("/messages/users");
}

export function signalTyping(channelId: string) {
  return api.post<void>(`/messages/channels/${channelId}/typing`, {});
}

export function markChannelRead(channelId: string) {
  return api.post<void>(`/messages/channels/${channelId}/read`, {});
}
