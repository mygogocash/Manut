import {
  ApiError,
  applyChannelMessageEvent,
  channelMessagesQueryKey,
  listChannelMessages,
  listMessageChannels,
  MESSAGE_CHANNELS_QUERY_KEY,
  REALTIME_DO_CHAT_GAP,
  sendChannelMessage,
  sendChannelMessageInputSchema,
  type ChannelMessage,
  type ChannelMessageList,
  type MessageChannel,
  type MessagesLiveEvent,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  joinMessagesLiveChannel,
  type MessagesLiveTransport,
} from "@/platform/messages-live";
import type { MessagesSocketStatus } from "@/platform/messages-socket";
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

function appendLiveMessage(
  current: ChannelMessageList | undefined,
  event: MessagesLiveEvent,
): ChannelMessageList | undefined {
  if (!current) return current;
  return {
    ...current,
    data: applyChannelMessageEvent(current.data, event),
  };
}

export function MessagesScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("messages:read");
  const canCreate = hasPermission("messages:create");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [socketStatus, setSocketStatus] =
    useState<MessagesSocketStatus>("idle");
  const [liveTransport, setLiveTransport] =
    useState<MessagesLiveTransport | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesKey = channelMessagesQueryKey(selectedChannelId ?? "", {
    page: 1,
    limit: 50,
  });

  const channelsQuery = useQuery({
    queryKey: MESSAGE_CHANNELS_QUERY_KEY,
    queryFn: ({ signal }) => listMessageChannels(api, signal),
    enabled: canRead,
  });

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: ({ signal }) =>
      listChannelMessages(
        api,
        selectedChannelId!,
        { page: 1, limit: 50 },
        signal,
      ),
    enabled: canRead && selectedChannelId != null,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => {
      if (!selectedChannelId) {
        throw new Error("Select a conversation before sending.");
      }
      return sendChannelMessage(api, selectedChannelId, { content });
    },
    onSuccess: (message) => {
      setDraft("");
      setSendError(null);
      queryClient.setQueryData<ChannelMessageList>(messagesKey, (current) =>
        appendLiveMessage(current, {
          type: "message.created",
          channelId: message.channelId ?? selectedChannelId!,
          payload: message,
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: MESSAGE_CHANNELS_QUERY_KEY,
      });
    },
    onError: (error) => {
      setSendError(errorMessage(error, "We could not send that message."));
    },
  });

  useEffect(() => {
    if (!selectedChannelId || !canRead) {
      return;
    }
    setLiveTransport(null);
    const client = joinMessagesLiveChannel({
      channelId: selectedChannelId,
      onStatus: setSocketStatus,
      onTransport: setLiveTransport,
      onEvent: (event) => {
        queryClient.setQueryData<ChannelMessageList>(messagesKey, (current) =>
          appendLiveMessage(current, event),
        );
      },
    });
    return () => {
      client.close();
    };
  }, [canRead, messagesKey, queryClient, selectedChannelId]);

  const liveSocketStatus =
    selectedChannelId && canRead ? socketStatus : "idle";

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

  function submitDraft() {
    const parsed = sendChannelMessageInputSchema.safeParse({ content: draft });
    if (!parsed.success) {
      setSendError("Enter a message before sending.");
      return;
    }
    setSendError(null);
    sendMutation.mutate(parsed.data.content);
  }

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
            Live send and receive via edge Durable Object when available
            (socket.io fallback). REST loads history.
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
                    setDraft("");
                    setSendError(null);
                    sendMutation.reset();
                  }}
                />
              ))}
            </View>
          )
        ) : null}

        {selectedChannel ? (
          <Card
            title={selectedChannel.name || "Conversation"}
            description={`History via REST · live: ${liveSocketStatus}${
              liveTransport ? ` (${liveTransport})` : ""
            }`}
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
                    .sort(
                      (a, b) =>
                        new Date(a.createdAt).getTime() -
                        new Date(b.createdAt).getTime(),
                    )
                    .map((message) => (
                      <MessageRow key={message.id} message={message} />
                    ))}
                </View>
              )
            ) : null}

            {canCreate ? (
              <View style={{ gap: spacing.sm }}>
                <TextInput
                  accessibilityLabel="Message composer"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Write a message"
                  editable={!sendMutation.isPending}
                  multiline
                  style={{
                    minHeight: 72,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radii.card,
                    backgroundColor: colors.surfaceRaised,
                    color: colors.text,
                  }}
                />
                {sendError ? (
                  <StatusMessage tone="error">{sendError}</StatusMessage>
                ) : null}
                <Button
                  label="Send message"
                  pendingLabel="Sending…"
                  accessibilityLabel="Send message"
                  pending={sendMutation.isPending}
                  onPress={submitDraft}
                />
              </View>
            ) : (
              <StatusMessage>
                Your role can read this conversation but cannot send messages.
              </StatusMessage>
            )}

            <Button
              label="Refresh history"
              pendingLabel="Refreshing…"
              accessibilityLabel="Refresh message history"
              pending={messagesQuery.isFetching}
              onPress={() => {
                void messagesQuery.refetch();
              }}
            />
            <Text selectable style={{ color: colors.textMuted, fontSize: 12 }}>
              {REALTIME_DO_CHAT_GAP}
            </Text>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
