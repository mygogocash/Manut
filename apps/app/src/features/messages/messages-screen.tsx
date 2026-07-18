import {
  ApiError,
  listMessageChannels,
  MESSAGE_CHANNELS_QUERY_KEY,
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
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function channelKindLabel(channel: MessageChannel): string {
  if (channel.type === "dm") return "Direct message";
  return channel.isPrivate ? "Private channel" : "Channel";
}

function ChannelRow({ channel }: { channel: MessageChannel }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
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
    </View>
  );
}

export function MessagesScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("messages:read");

  const channelsQuery = useQuery({
    queryKey: MESSAGE_CHANNELS_QUERY_KEY,
    queryFn: ({ signal }) => listMessageChannels(api, signal),
    enabled: canRead,
  });

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
            Read-only conversation list from the REST channels API. Live
            websocket chat is not wired in Expo yet.
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
                <ChannelRow key={channel.id} channel={channel} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
