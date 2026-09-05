import { PERMISSIONS } from "@nexora/contracts";
import { ForbiddenException } from "../http-exception.js";

export interface MessageAccessUser {
  id: string;
  permissions: string[];
}

export interface MessageAccessChannel {
  id: string;
  type: string;
  members: { userId: string }[];
}

export function channelMemberIds(channel: Pick<MessageAccessChannel, "members">) {
  return channel.members.map((m) => m.userId);
}

export function hasMessagePermission(user: MessageAccessUser, permission: string) {
  return user.permissions.includes(permission);
}

export function canAccessChannel(user: MessageAccessUser, channel: MessageAccessChannel) {
  const memberIds = channelMemberIds(channel);
  if (channel.type === "direct") return memberIds.includes(user.id);
  if (channel.type === "private") {
    return memberIds.includes(user.id) || hasMessagePermission(user, PERMISSIONS.MESSAGES_ADMIN);
  }
  return hasMessagePermission(user, PERMISSIONS.MESSAGES_READ);
}

export function assertCanAccessChannel(user: MessageAccessUser, channel: MessageAccessChannel) {
  if (!canAccessChannel(user, channel)) {
    throw new ForbiddenException("You do not have access to this channel");
  }
}
