import {
  ApiError,
  getProjectsDashboard,
  projectsDashboardQueryKey,
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

function canReadProjects(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("projects:read") ||
    hasPermission("projects:read-all") ||
    hasPermission("it-crm:read") ||
    hasPermission("it-crm:read-all") ||
    hasPermission("product-crm:read") ||
    hasPermission("product-crm:read-all") ||
    hasPermission("legal-crm:read") ||
    hasPermission("legal-crm:read-all") ||
    hasPermission("accounting-crm:read") ||
    hasPermission("accounting-crm:read-all") ||
    hasPermission("hr-crm:read") ||
    hasPermission("hr-crm:read-all")
  );
}

export function ProjectsDashboardScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadProjects(hasPermission);

  const dashboardQuery = useQuery({
    queryKey: projectsDashboardQueryKey({ team: "general" }),
    queryFn: ({ signal }) =>
      getProjectsDashboard(api, { team: "general" }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Projects dashboard" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view the projects dashboard.
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
            Projects dashboard
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only general team rollup. Charts export and deep team
            switchers remain later.
          </Text>
        </View>

        <Button
          label="Back to projects"
          accessibilityLabel="Back to projects"
          onPress={() => router.push("/projects")}
        />

        {dashboardQuery.isPending ? (
          <LoadingState label="Loading dashboard…" />
        ) : null}

        {dashboardQuery.isError ? (
          <Card title="Dashboard unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                dashboardQuery.error,
                "We could not load the projects dashboard.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry projects dashboard"
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
