export interface MessagesChannelMember {
  userId: string;
  role?: string;
}

export interface MessagesChannelRecord {
  id: string;
  title: string | null;
  type: string;
  members: MessagesChannelMember[];
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
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

export interface MessagesStore {
  loadPermissions(userId: string): Promise<Set<string>>;
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
}
