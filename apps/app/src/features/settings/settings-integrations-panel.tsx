import {
  ApiError,
  disconnectGoogle,
  getIntegrationsStatus,
  INTEGRATIONS_STATUS_QUERY_KEY,
  oauthReturnMessage,
  startGoogleOauth,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function SettingsIntegrationsPanel() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canUse = hasPermission("integrations:use");
  const params = useLocalSearchParams<{
    connected?: string | string[];
    error?: string | string[];
    tab?: string | string[];
  }>();
  const [returnNotice, setReturnNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connectedParam = Array.isArray(params.connected)
    ? params.connected[0]
    : params.connected;
  const errorParam = Array.isArray(params.error)
    ? params.error[0]
    : params.error;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  useEffect(() => {
    const notice = oauthReturnMessage(connectedParam, errorParam);
    if (!notice) return;
    setReturnNotice(notice);
    const next =
      tabParam != null && tabParam.length > 0
        ? `/settings?tab=${encodeURIComponent(tabParam)}`
        : "/settings";
    router.replace(next);
  }, [connectedParam, errorParam, router, tabParam]);

  const statusQuery = useQuery({
    queryKey: INTEGRATIONS_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => getIntegrationsStatus(api, signal),
    enabled: canUse,
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      startGoogleOauth(api, { redirect: "/settings?tab=integrations" }),
    onSuccess: async ({ url }) => {
      await Linking.openURL(url);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGoogle(api),
    onSuccess: () => {
      setConfirmDisconnect(false);
      setReturnNotice({
        tone: "success",
        message: "Google account disconnected",
      });
      void queryClient.invalidateQueries({
        queryKey: INTEGRATIONS_STATUS_QUERY_KEY,
      });
    },
  });

  if (!canUse) {
    return (
      <Card
        title="Integrations"
        description="Connect Google Workspace when your role allows it"
      >
        <StatusMessage>
          Your role cannot manage Google Workspace integrations.
        </StatusMessage>
      </Card>
    );
  }

  const google = statusQuery.data?.google;

  return (
    <Card
      title="Integrations"
      description="Connect Google Workspace for Gmail and Drive features"
    >
      <View style={{ gap: spacing.md }}>
        {returnNotice ? (
          <StatusMessage tone={returnNotice.tone}>
            {returnNotice.message}
          </StatusMessage>
        ) : null}

        {statusQuery.isPending ? (
          <LoadingState label="Loading integrations…" />
        ) : null}

        {statusQuery.isError ? (
          <>
            <StatusMessage tone="error">
              {errorMessage(
                statusQuery.error,
                "Failed to load integration status",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry integrations"
              pending={statusQuery.isFetching}
              onPress={() => {
                void statusQuery.refetch();
              }}
            />
          </>
        ) : null}

        {google ? (
          <View style={{ gap: spacing.sm }}>
            <Text
              selectable
              style={{ color: colors.text, fontWeight: "600" }}
            >
              Google Workspace
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              {google.connected
                ? `Connected as ${google.accountEmail ?? "(unknown)"}`
                : "Connect your Google Workspace account to enable Gmail and Drive in Intranet."}
            </Text>
            {google.connected && google.canSendMail === false ? (
              <StatusMessage tone="warning">
                Gmail is read-only on this connection. Disconnect and reconnect
                to enable sending from the portal.
              </StatusMessage>
            ) : null}

            {connectMutation.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  connectMutation.error,
                  "Failed to start Google sign-in",
                )}
              </StatusMessage>
            ) : null}
            {disconnectMutation.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  disconnectMutation.error,
                  "Failed to disconnect Google",
                )}
              </StatusMessage>
            ) : null}

            {google.connected ? (
              confirmDisconnect ? (
                <View style={{ gap: spacing.sm }}>
                  <Text selectable style={{ color: colors.text }}>
                    Disconnect Google Workspace from this account?
                  </Text>
                  <Button
                    label="Confirm disconnect"
                    pendingLabel="Disconnecting…"
                    accessibilityLabel="Confirm disconnect Google"
                    pending={disconnectMutation.isPending}
                    onPress={() => disconnectMutation.mutate()}
                  />
                  <Button
                    label="Keep connected"
                    pendingLabel="Keeping…"
                    accessibilityLabel="Keep Google connected"
                    disabled={disconnectMutation.isPending}
                    onPress={() => setConfirmDisconnect(false)}
                  />
                </View>
              ) : (
                <Button
                  label="Disconnect"
                  pendingLabel="Opening…"
                  accessibilityLabel="Disconnect Google"
                  onPress={() => setConfirmDisconnect(true)}
                />
              )
            ) : (
              <Button
                label="Connect Google"
                pendingLabel="Opening…"
                accessibilityLabel="Connect Google"
                pending={connectMutation.isPending}
                onPress={() => connectMutation.mutate()}
              />
            )}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
