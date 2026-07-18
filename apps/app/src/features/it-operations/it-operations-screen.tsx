import {
  ApiError,
  getItOpsDashboard,
  itOpsDashboardQueryKey,
  type ItOpsDashboard,
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

function canViewDashboard(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("it:dashboard:view") ||
    hasPermission("it:billing:view") ||
    hasPermission("it:access:view") ||
    hasPermission("it:access:request") ||
    hasPermission("it:access:manage")
  );
}

function DashboardPanel({ data }: { data: ItOpsDashboard }) {
  const spend = Object.entries(data.monthlySpendByCurrency)
    .map(([currency, amount]) => `${amount} ${currency}`)
    .join(" · ");

  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text }}>
        Active subscriptions: {data.activeSubscriptions}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Pending access requests: {data.pendingAccessRequests} · Renewals (7d):{" "}
        {data.upcomingRenewals7}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Licenses: {data.assignedLicenses}/{data.totalLicenses} assigned (
        {data.unusedLicenses} unused)
      </Text>
      {spend ? (
        <Text selectable style={{ color: colors.textMuted }}>
          Monthly spend: {spend}
        </Text>
      ) : null}
    </View>
  );
}

export function ItOperationsScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canViewDashboard(hasPermission);

  const dashboardQuery = useQuery({
    queryKey: itOpsDashboardQueryKey(),
    queryFn: ({ signal }) => getItOpsDashboard(api, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="IT Operations" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view IT Operations.
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
        <Card title="IT Operations" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only KPI panel. Charts and recent access identity rows are
              deferred.
            </Text>
            {dashboardQuery.isLoading ? (
              <LoadingState label="Loading IT Operations…" />
            ) : null}
            {dashboardQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    dashboardQuery.error,
                    "Unable to load IT Operations dashboard.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void dashboardQuery.refetch()}
                />
              </View>
            ) : null}
            {dashboardQuery.data ? (
              <DashboardPanel data={dashboardQuery.data} />
            ) : null}
            <Button
              label="Access requests"
      pendingLabel="Working…"
              onPress={() => router.push("/it-operations/access")}
            />
            <Button
              label="Billing subscriptions"
      pendingLabel="Working…"
              onPress={() => router.push("/it-operations/billing")}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
