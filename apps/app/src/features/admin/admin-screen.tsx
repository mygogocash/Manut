import {
  adminUserStatsQueryKey,
  ApiError,
  getAdminUserStats,
  type AdminUserStats,
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
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canOpenAdmin(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("admin:read") || hasPermission("admin:manage");
}

function StatsPanel({ stats }: { stats: AdminUserStats }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text }}>
        Total users: {stats.total}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Active: {stats.active} · Inactive: {stats.inactive} · New this month:{" "}
        {stats.newThisMonth}
      </Text>
    </View>
  );
}

export function AdminScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canOpenAdmin(hasPermission);
  const canLoadStats = hasPermission("user:read");

  const statsQuery = useQuery({
    queryKey: adminUserStatsQueryKey(),
    queryFn: ({ signal }) => getAdminUserStats(api, signal),
    enabled: allowed && canLoadStats,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Admin" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view admin.
          </StatusMessage>
        </Card>
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
        <Card title="Admin" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only workspace headcount. Audit log and full usage reports
              remain deferred.
            </Text>
            {!canLoadStats ? (
              <StatusMessage tone="warning">
                User counts require user:read. Open Form config for department
                list access with admin:read.
              </StatusMessage>
            ) : null}
            {canLoadStats && statsQuery.isLoading ? (
              <LoadingState label="Loading user counts…" />
            ) : null}
            {canLoadStats && statsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    statsQuery.error,
                    "Unable to load user counts.",
                  )}
                </StatusMessage>
                <Button label="Retry"
      pendingLabel="Working…" onPress={() => void statsQuery.refetch()} />
              </View>
            ) : null}
            {statsQuery.data ? <StatsPanel stats={statsQuery.data} /> : null}
            <Button
              label="Form configuration"
      pendingLabel="Working…"
              onPress={() => router.push("/admin/form-config")}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
