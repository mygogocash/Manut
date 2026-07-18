export const MESSAGES_READ = "messages:read";
export const MESSAGES_CREATE = "messages:create";
export const MESSAGES_DELETE = "messages:delete";
export const MESSAGES_ADMIN = "messages:admin";

export interface MessageAccessUser {
  id: string;
  permissions: string[];
}

export interface MessageAccessChannel {
  id: string;
  type: string;
  members: { userId: string }[];
}

export function hasMessagePermission(
  user: MessageAccessUser,
  permission: string,
): boolean {
  return user.permissions.includes(permission);
}

export function canAccessChannel(
  user: MessageAccessUser,
  channel: MessageAccessChannel,
): boolean {
  const memberIds = channel.members.map((member) => member.userId);

  if (channel.type === "direct") {
    return memberIds.includes(user.id);
  }

  if (channel.type === "private") {
    return (
      memberIds.includes(user.id) ||
      hasMessagePermission(user, MESSAGES_ADMIN)
    );
  }

  // Public/group channels: permission gate only (matches Express access).
  return hasMessagePermission(user, MESSAGES_READ);
}
