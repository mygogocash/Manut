import {
  ApiError,
  DASHBOARD_STATS_QUERY_KEY,
  getDashboardStats,
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
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load dashboard stats.";
}

export function DashboardScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { user, roles, permissions, logout, hasPermission } = useAuth();
  const canReadHome = hasPermission("home:read");
  const statsQuery = useQuery({
    queryKey: DASHBOARD_STATS_QUERY_KEY,
    queryFn: ({ signal }) => getDashboardStats(api, signal),
    enabled: canReadHome,
  });

  const showLeaveKpi =
    hasPermission("leave:read") ||
    hasPermission("leave:approve") ||
    hasPermission("leave:hr-read");
  const showExpenseKpi =
    hasPermission("expense:read") ||
    hasPermission("expense:approve") ||
    hasPermission("expense:hr-read");
  const showProjectsKpi = hasPermission("projects:read");

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
      <View style={{ width: "100%", maxWidth: 1080, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Welcome, {user?.name ?? "teammate"}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Permission-gated home widgets for your Manut session.
          </Text>
        </View>

        <Card title="Session summary">
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text }}>
              Roles: {roles.map((role) => role.name).join(", ") || "None"}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Permissions loaded: {permissions.length.toLocaleString()}
            </Text>
          </View>
        </Card>

        {!canReadHome ? (
          <Card title="Home widgets unavailable">
            <Text selectable style={{ color: colors.textMuted }}>
              Your account does not include home:read, so dashboard stats stay
              hidden.
            </Text>
          </Card>
        ) : null}

        {canReadHome && statsQuery.isPending ? (
          <LoadingState label="Loading dashboard…" />
        ) : null}

        {canReadHome && statsQuery.isError ? (
          <Card title="Unable to load dashboard">
            <StatusMessage tone="error">
              {errorMessage(statsQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              onPress={() => {
                void statsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {statsQuery.data ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.md,
            }}
          >
            {showLeaveKpi ? (
              <Card title="Pending leave" maxWidth={320}>
                <Text
                  selectable
                  style={{ fontSize: 28, fontWeight: "700", color: colors.text }}
                >
                  {statsQuery.data.kpis.pendingLeaves}
                </Text>
              </Card>
            ) : null}
            {showExpenseKpi ? (
              <Card title="Pending expenses" maxWidth={320}>
                <Text
                  selectable
                  style={{ fontSize: 28, fontWeight: "700", color: colors.text }}
                >
                  {statsQuery.data.kpis.pendingExpenses}
                </Text>
              </Card>
            ) : null}
            {showProjectsKpi ? (
              <Card title="Active projects" maxWidth={320}>
                <Text
                  selectable
                  style={{ fontSize: 28, fontWeight: "700", color: colors.text }}
                >
                  {statsQuery.data.kpis.activeProjects}
                </Text>
              </Card>
            ) : null}
          </View>
        ) : null}

        {statsQuery.data && statsQuery.data.pendingActions.length > 0 ? (
          <Card title="Pending actions">
            <View style={{ gap: spacing.sm }}>
              {statsQuery.data.pendingActions.map((action) => (
                <Pressable
                  key={`${action.kind}-${action.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${action.title}`}
                  onPress={() => {
                    router.push(action.href as "/leave");
                  }}
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text
                      selectable
                      style={{ color: colors.text, fontWeight: "700" }}
                    >
                      {action.title}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {action.subtitle}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        <Button
          label="Sign out"
          pendingLabel="Signing out…"
          accessibilityLabel="Sign out"
          onPress={() => {
            void logout();
          }}
        />
      </View>
    </ScrollView>
  );
}
