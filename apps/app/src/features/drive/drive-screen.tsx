import {
  ApiError,
  driveListQueryKey,
  getIntegrationsStatus,
  INTEGRATIONS_STATUS_QUERY_KEY,
  isGoogleNotConnectedError,
  listDrive,
  startGoogleOauth,
  type DriveFile,
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
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatModified(raw: string | null): string {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DriveRow({
  file,
  onOpen,
}: {
  file: DriveFile;
  onOpen: () => void;
}) {
  const canOpen = file.webViewLink != null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        canOpen ? `Open ${file.name} in Google Drive` : file.name
      }
      disabled={!canOpen}
      onPress={onOpen}
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
        opacity: canOpen ? 1 : 0.7,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {file.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {file.mimeType ?? "File"}
        {` · Modified ${formatModified(file.modifiedTime)}`}
        {file.shared ? " · Shared" : ""}
      </Text>
      {canOpen ? (
        <Text selectable style={{ color: colors.accent, fontWeight: "600" }}>
          Open in Google Drive
        </Text>
      ) : null}
    </Pressable>
  );
}

export function DriveScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const canUse = hasPermission("integrations:use");

  const statusQuery = useQuery({
    queryKey: INTEGRATIONS_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => getIntegrationsStatus(api, signal),
    enabled: canUse,
  });

  const connected = statusQuery.data?.google.connected === true;

  const driveQuery = useQuery({
    queryKey: driveListQueryKey({ pageSize: 25 }),
    queryFn: () => listDrive(api, { pageSize: 25 }),
    enabled: canUse && connected,
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: () => startGoogleOauth(api, { redirect: "/drive" }),
    onSuccess: async ({ url }) => {
      await Linking.openURL(url);
    },
  });

  const notConnected =
    !connected ||
    isGoogleNotConnectedError(driveQuery.error) ||
    (driveQuery.isError &&
      driveQuery.error instanceof ApiError &&
      driveQuery.error.status === 412);

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
            title="Google Drive"
            description="Connect Google Workspace when your role allows it"
          >
            <StatusMessage>
              Your role cannot use Google Drive integrations.
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
            Google Drive
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Your Google Workspace files through Manut-owned OAuth. Local uploads
            stay on Files.
          </Text>
        </View>

        {statusQuery.isPending ? (
          <LoadingState label="Checking Google connection…" />
        ) : null}

        {statusQuery.isError ? (
          <Card title="Drive unavailable">
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
              Drive files. No placeholder files are shown.
            </StatusMessage>
            {statusQuery.data.google.accountEmail ? (
              <Text selectable style={{ color: colors.textMuted }}>
                Last account: {statusQuery.data.google.accountEmail}
              </Text>
            ) : null}
            <Button
              label="Connect Google"
              pendingLabel="Opening…"
              accessibilityLabel="Connect Google for Drive"
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

        {connected && driveQuery.isPending ? (
          <LoadingState label="Loading Drive files…" />
        ) : null}

        {connected && driveQuery.isError && !notConnected ? (
          <Card title="Drive unavailable">
            <StatusMessage tone="error">
              {errorMessage(driveQuery.error, "We could not load Drive files.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry Drive files"
              pending={driveQuery.isFetching}
              onPress={() => {
                void driveQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {connected && driveQuery.data ? (
          driveQuery.data.data.length === 0 ? (
            <Card title="No Drive files">
              <Text selectable style={{ color: colors.textMuted }}>
                No files matched in your Google Drive.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Drive files" style={{ gap: spacing.md }}>
              {driveQuery.data.data.map((file, index) => (
                <DriveRow
                  key={file.id ?? `${file.name}-${index}`}
                  file={file}
                  onOpen={() => {
                    if (file.webViewLink) {
                      void Linking.openURL(file.webViewLink);
                    }
                  }}
                />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
