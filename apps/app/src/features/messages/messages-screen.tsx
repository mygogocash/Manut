import {
  ApiError,
  channelMessagesQueryKey,
  listChannelMessages,
  listMessageChannels,
  MESSAGE_CHANNELS_QUERY_KEY,
  REALTIME_LIVE_CHAT_BLOCKER,
  type ChannelMessage,
  type MessageChannel,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  radii,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { getRealtimeOrigin } from "@/platform/realtime-origin";
import {
  joinRealtimeRoom,
  type RealtimeRoomStatus,
} from "@/platform/realtime-room";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function channelKindLabel(channel: MessageChannel): string {
  if (channel.type === "dm") return "Direct message";
  return channel.isPrivate ? "Private channel" : "Channel";
}

function formatMessageTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChannelRow({
  channel,
  selected,
  onSelect,
}: {
  channel: MessageChannel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${channel.name || "conversation"}`}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {channel.name || "Untitled conversation"}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {channelKindLabel(channel)}
        {` · ${channel.messageCount} messages`}
        {channel.unreadCount > 0 ? ` · ${channel.unreadCount} unread` : ""}
      </Text>
      {channel.description ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {channel.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MessageRow({ message }: { message: ChannelMessage }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.canvas,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {message.authorName}
        <Text style={{ fontWeight: "400", color: colors.textMuted }}>
          {` · ${formatMessageTime(message.createdAt)}`}
        </Text>
      </Text>
      <Text selectable style={{ color: colors.text }}>
        {message.isDeleted ? "(message deleted)" : message.content || "—"}
      </Text>
    </View>
  );
}

export function MessagesScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("messages:read");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [roomStatus, setRoomStatus] = useState<RealtimeRoomStatus>("idle");

  const channelsQuery = useQuery({
    queryKey: MESSAGE_CHANNELS_QUERY_KEY,
    queryFn: ({ signal }) => listMessageChannels(api, signal),
    enabled: canRead,
  });

  const messagesQuery = useQuery({
    queryKey: channelMessagesQueryKey(selectedChannelId ?? "", {
      page: 1,
      limit: 50,
    }),
    queryFn: ({ signal }) =>
      listChannelMessages(
        api,
        selectedChannelId!,
        { page: 1, limit: 50 },
        signal,
      ),
    enabled: canRead && selectedChannelId != null,
  });

  useEffect(() => {
    if (!selectedChannelId) {
      setRoomStatus("idle");
      return;
    }
    const origin = getRealtimeOrigin();
    if (!origin) {
      setRoomStatus("error");
      return;
    }
    const client = joinRealtimeRoom({
      origin,
      roomId: selectedChannelId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 96),
      onStatus: setRoomStatus,
    });
    return () => {
      client.close();
    };
  }, [selectedChannelId]);

  if (!canRead) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          padding: spacing.xxl,
          backgroundColor: colors.canvas,
        }}
      >
        <View style={{ width: "100%", maxWidth: 720 }}>
          <Card
            title="Messages"
            description="Conversations require messaging access"
          >
            <StatusMessage>
              Your role cannot read messaging channels.
            </StatusMessage>
          </Card>
        </View>
      </ScrollView>
    );
  }

  const selectedChannel = channelsQuery.data?.data.find(
    (channel) => channel.id === selectedChannelId,
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <View style={{ width: "100%", maxWidth: 720, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Messages
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Channel list and REST message history. {REALTIME_LIVE_CHAT_BLOCKER}
          </Text>
        </View>

        {channelsQuery.isPending ? (
          <LoadingState label="Loading conversations…" />
        ) : null}

        {channelsQuery.isError ? (
          <Card title="Messages unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                channelsQuery.error,
                "We could not load conversations.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry messages"
              pending={channelsQuery.isFetching}
              onPress={() => {
                void channelsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {channelsQuery.data ? (
          channelsQuery.data.data.length === 0 ? (
            <Card title="No conversations">
              <Text selectable style={{ color: colors.textMuted }}>
                You do not have any messaging channels yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Message channels"
              style={{ gap: spacing.md }}
            >
              {channelsQuery.data.data.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  selected={channel.id === selectedChannelId}
                  onSelect={() => {
                    setSelectedChannelId(channel.id);
                  }}
                />
              ))}
            </View>
          )
        ) : null}

        {selectedChannel ? (
          <Card
            title={selectedChannel.name || "Conversation"}
            description={`History via GET /messages/channels/:id/messages · DO probe: ${roomStatus}`}
          >
            {messagesQuery.isPending ? (
              <LoadingState label="Loading messages…" />
            ) : null}
            {messagesQuery.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  messagesQuery.error,
                  "We could not load message history.",
                )}
              </StatusMessage>
            ) : null}
            {messagesQuery.data ? (
              messagesQuery.data.data.length === 0 ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  No messages in this conversation yet.
                </Text>
              ) : (
                <View
                  accessibilityLabel="Channel messages"
                  style={{ gap: spacing.sm }}
                >
                  {[...messagesQuery.data.data]
                    .reverse()
                    .map((message) => (
                      <MessageRow key={message.id} message={message} />
                    ))}
                </View>
              )
            ) : null}
            <Button
              label="Refresh history"
              pendingLabel="Refreshing…"
              accessibilityLabel="Refresh message history"
              pending={messagesQuery.isFetching}
              onPress={() => {
                void messagesQuery.refetch();
              }}
            />
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
