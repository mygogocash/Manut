import {
  ApiError,
  getIntegrationsStatus,
  gmailListQueryKey,
  INTEGRATIONS_STATUS_QUERY_KEY,
  isGoogleNotConnectedError,
  listGmail,
  startGoogleOauth,
  type GmailListItem,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GmailRow({ item }: { item: GmailListItem }) {
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
      <Text
        selectable
        style={{
          fontWeight: item.unread ? "700" : "600",
          color: colors.text,
        }}
      >
        {item.subject}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {item.from ?? "Unknown sender"}
        {` · ${formatDate(item.date)}`}
        {item.unread ? " · Unread" : ""}
      </Text>
      {item.snippet ? (
        <Text selectable style={{ color: colors.textMuted }} numberOfLines={2}>
          {item.snippet}
        </Text>
      ) : null}
    </View>
  );
}

export function GmailScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const canUse = hasPermission("integrations:use");

  const statusQuery = useQuery({
    queryKey: INTEGRATIONS_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => getIntegrationsStatus(api, signal),
    enabled: canUse,
  });

  const connected = statusQuery.data?.google.connected === true;

  const gmailQuery = useQuery({
    queryKey: gmailListQueryKey({ folder: "inbox", pageSize: 25 }),
    queryFn: () => listGmail(api, { folder: "inbox", pageSize: 25 }),
    enabled: canUse && connected,
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: () => startGoogleOauth(api, { redirect: "/gmail" }),
    onSuccess: async ({ url }) => {
      await Linking.openURL(url);
    },
  });

  const notConnected =
    !connected ||
    isGoogleNotConnectedError(gmailQuery.error) ||
    (gmailQuery.isError &&
      gmailQuery.error instanceof ApiError &&
      gmailQuery.error.status === 412);

  if (!canUse) {
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
            title="Gmail"
            description="Connect Google Workspace when your role allows it"
          >
            <StatusMessage>
              Your role cannot use Gmail integrations.
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
            Gmail
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Inbox through Manut-owned Google OAuth. No placeholder mail is shown.
          </Text>
        </View>

        {statusQuery.isPending ? (
          <LoadingState label="Checking Google connection…" />
        ) : null}

        {statusQuery.isError ? (
          <Card title="Gmail unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                statusQuery.error,
                "We could not load Google connection status.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry Google status"
              pending={statusQuery.isFetching}
              onPress={() => {
                void statusQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {statusQuery.data && notConnected ? (
          <Card title="Google not connected">
            <StatusMessage>
              Connect Google Workspace in Settings or start OAuth here to list
              Gmail. No placeholder messages are shown.
            </StatusMessage>
            {statusQuery.data.google.accountEmail ? (
              <Text selectable style={{ color: colors.textMuted }}>
                Last account: {statusQuery.data.google.accountEmail}
              </Text>
            ) : null}
            <Button
              label="Connect Google"
              pendingLabel="Opening…"
              accessibilityLabel="Connect Google for Gmail"
              pending={connectMutation.isPending}
              onPress={() => {
                connectMutation.mutate();
              }}
            />
            {connectMutation.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  connectMutation.error,
                  "Failed to start Google sign-in",
                )}
              </StatusMessage>
            ) : null}
          </Card>
        ) : null}

        {connected && gmailQuery.isPending ? (
          <LoadingState label="Loading inbox…" />
        ) : null}

        {connected && gmailQuery.isError && !notConnected ? (
          <Card title="Gmail unavailable">
            <StatusMessage tone="error">
              {errorMessage(gmailQuery.error, "We could not load Gmail.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry Gmail inbox"
              pending={gmailQuery.isFetching}
              onPress={() => {
                void gmailQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {connected && gmailQuery.data ? (
          gmailQuery.data.data.length === 0 ? (
            <Card title="Inbox empty">
              <Text selectable style={{ color: colors.textMuted }}>
                No messages matched in your Gmail inbox.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Gmail inbox" style={{ gap: spacing.md }}>
              {gmailQuery.data.data.map((item, index) => (
                <GmailRow
                  key={item.id ?? `${item.subject}-${index}`}
                  item={item}
                />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
