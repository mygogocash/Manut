export interface MessagesChannelMember {
  userId: string;
  role?: string;
  leftAt?: string | Date | null;
}

export interface MessagesChannelRecord {
  id: string;
  title: string | null;
  type: string;
  members: MessagesChannelMember[];
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  directKey?: string | null;
  _count?: { messages?: number };
  creator?: { id: string; name: string | null; avatarUrl?: string | null };
}

export interface MessagesMessageRecord {
  id: string;
  conversationId: string;
  authorId: string;
  content: string | null;
  deletedForEveryoneAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  author?: { id: string; name: string | null; avatarUrl?: string | null } | null;
}

export interface MessagesUserRecord {
  id: string;
  name: string | null;
  avatarUrl?: string | null;
}

export interface CreateChannelStoreInput {
  name: string;
  isPrivate: boolean;
  members?: string[];
  createdBy: string;
  type?: "dm" | "channel";
}

export interface MessagesStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findUserProfile(
    userId: string,
  ): Promise<{ id: string; name: string | null } | null>;
  listActiveUsers(excludeUserId: string): Promise<MessagesUserRecord[]>;
  listChannelsForUser(
    userId: string,
    options: { includePrivateChannels?: boolean },
  ): Promise<MessagesChannelRecord[]>;
  findChannelById(id: string): Promise<MessagesChannelRecord | null>;
  countUnreadByChannel(
    userId: string,
    channelIds: string[],
  ): Promise<Record<string, number>>;
  findMessages(
    channelId: string,
    page: number,
    limit: number,
  ): Promise<{ data: MessagesMessageRecord[]; total: number }>;
  createMessage(input: {
    channelId: string;
    authorId: string;
    content: string;
  }): Promise<MessagesMessageRecord>;
  findMessageById(id: string): Promise<MessagesMessageRecord | null>;
  softDeleteMessage(
    id: string,
    deletedBy: string,
  ): Promise<MessagesMessageRecord | null>;
  markChannelRead(
    userId: string,
    channelId: string,
  ): Promise<{ lastReadAt: string | Date }>;
  hideConversationForUser(userId: string, channelId: string): Promise<void>;
  allMembersHaveLeft(channelId: string): Promise<boolean>;
  deleteChannel(id: string): Promise<void>;
  createChannel(input: CreateChannelStoreInput): Promise<MessagesChannelRecord>;
  updateChannel(
    id: string,
    input: { name?: string },
  ): Promise<MessagesChannelRecord>;
  findDirectChannel(
    memberIds: string[],
  ): Promise<MessagesChannelRecord | null>;
  restoreConversationMembership(
    userId: string,
    channelId: string,
  ): Promise<void>;
}

export function directChannelName(userIds: string[]): string {
  return `dm:${[...userIds].sort().join(":")}`;
}
