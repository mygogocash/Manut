import {
  ApiError,
  getSystemSettings,
  SYSTEM_SETTINGS_QUERY_KEY,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function SettingsSystemPanel() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = hasPermission("admin:manage");

  const settingsQuery = useQuery({
    queryKey: SYSTEM_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => getSystemSettings(api, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return null;
  }

  return (
    <Card
      title="System settings"
      description="Global configuration visible to administrators (read-only)"
    >
      {settingsQuery.isPending ? (
        <LoadingState label="Loading system settings…" />
      ) : null}

      {settingsQuery.isError ? (
        <View style={{ gap: spacing.md }}>
          <StatusMessage tone="error">
            {errorMessage(
              settingsQuery.error,
              "We could not load system settings.",
            )}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry system settings"
            pending={settingsQuery.isFetching}
            onPress={() => {
              void settingsQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {settingsQuery.data ? (
        settingsQuery.data.entries.length === 0 ? (
          <Text selectable style={{ color: colors.textMuted }}>
            No system settings are configured yet.
          </Text>
        ) : (
          <View
            accessibilityLabel="System settings"
            style={{ gap: spacing.lg }}
          >
            {settingsQuery.data.entries.map((entry) => (
              <View key={entry.key} style={{ gap: spacing.xs }}>
                <Text
                  selectable
                  style={{ color: colors.textMuted, fontSize: 13 }}
                >
                  {entry.key}
                </Text>
                <Text
                  selectable
                  style={{ color: colors.text, fontWeight: "600" }}
                >
                  {entry.value || "—"}
                </Text>
              </View>
            ))}
          </View>
        )
      ) : null}
    </Card>
  );
}
