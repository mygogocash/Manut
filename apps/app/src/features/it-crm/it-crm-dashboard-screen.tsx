import {
  ApiError,
  getItCrmDashboard,
  itCrmDashboardQueryKey,
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

function canReadItCrm(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("it-crm:read") ||
    hasPermission("it-crm:read-all") ||
    hasPermission("projects:read") ||
    hasPermission("projects:read-all")
  );
}

export function ItCrmDashboardScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadItCrm(hasPermission);

  const dashboardQuery = useQuery({
    queryKey: itCrmDashboardQueryKey(),
    queryFn: ({ signal }) => getItCrmDashboard(api, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="IT CRM dashboard" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view the IT CRM dashboard.
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
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            IT CRM dashboard
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only KPI rollup. Flow analytics, helpdesk SLA, and comments
            remain later.
          </Text>
        </View>

        <Button
          label="Back to IT CRM"
          accessibilityLabel="Back to IT CRM"
          onPress={() => router.push("/it-crm")}
        />

        {dashboardQuery.isPending ? (
          <LoadingState label="Loading dashboard…" />
        ) : null}

        {dashboardQuery.isError ? (
          <Card title="Dashboard unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                dashboardQuery.error,
                "We could not load the IT CRM dashboard.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry IT CRM dashboard"
              pending={dashboardQuery.isFetching}
              onPress={() => {
                void dashboardQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {dashboardQuery.data ? (
          <>
            <Card title="Snapshot" maxWidth={720}>
              <View style={{ gap: spacing.sm }}>
                <Text selectable style={{ color: colors.text }}>
                  Total: {dashboardQuery.data.total}
                </Text>
                <Text selectable style={{ color: colors.text }}>
                  In progress: {dashboardQuery.data.inProgress}
                </Text>
                <Text selectable style={{ color: colors.text }}>
                  At risk: {dashboardQuery.data.atRisk}
                </Text>
                <Text selectable style={{ color: colors.text }}>
                  Production live: {dashboardQuery.data.productionLive}
                </Text>
              </View>
            </Card>

            <Card title="By status" maxWidth={720}>
              {dashboardQuery.data.byStatus.length === 0 ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  No status buckets yet.
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {dashboardQuery.data.byStatus.map((bucket) => (
                    <Text
                      key={bucket.status}
                      selectable
                      style={{ color: colors.text }}
                    >
                      {bucket.status}: {bucket.count}
                    </Text>
                  ))}
                </View>
              )}
            </Card>

            <Card title="Upcoming go-lives" maxWidth={720}>
              {dashboardQuery.data.upcomingGoLives.length === 0 ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  No go-lives in the next two weeks.
                </Text>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {dashboardQuery.data.upcomingGoLives.map((row) => (
                    <View key={row.id} style={{ gap: spacing.xs }}>
                      <Text
                        selectable
                        style={{ fontWeight: "600", color: colors.text }}
                      >
                        {row.name}
                      </Text>
                      <Text selectable style={{ color: colors.textMuted }}>
                        {row.status}
                        {row.goLiveDate
                          ? ` · ${row.goLiveDate.slice(0, 10)}`
                          : ""}{" "}
                        · {row.owner.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
