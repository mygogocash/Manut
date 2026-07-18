import {
  ApiError,
  getInvestorDashboard,
  investorDashboardQueryKey,
  investorsQueryKey,
  listInvestors,
  type Investor,
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
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadInvestorCrm(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("investor-dashboard:read") ||
    hasPermission("investors:read") ||
    hasPermission("investors:read-all")
  );
}

function InvestorRow({ investor }: { investor: Investor }) {
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
        {investor.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {investor.type} · {investor.status}
        {investor.region ? ` · ${investor.region}` : ""}
      </Text>
    </View>
  );
}

export function InvestorCrmScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadInvestorCrm(hasPermission);
  const canReadDashboard = hasPermission("investor-dashboard:read");
  const canReadList =
    hasPermission("investors:read") || hasPermission("investors:read-all");

  const dashboardQuery = useQuery({
    queryKey: investorDashboardQueryKey(),
    queryFn: ({ signal }) => getInvestorDashboard(api, signal),
    enabled: allowed && canReadDashboard,
  });

  const investorsQuery = useQuery({
    queryKey: investorsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listInvestors(api, { page: 1, limit: 20 }, signal),
    enabled: allowed && canReadList,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Investor CRM" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view Investor CRM.
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
            Investor CRM
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only fundraising KPIs and recent investors. Pipeline funnel,
            notes, and contact writes remain later.
          </Text>
        </View>

        <Button
          label="Open investors"
          accessibilityLabel="Open investors"
          onPress={() => router.push("/investors")}
        />

        {canReadDashboard && dashboardQuery.isPending ? (
          <LoadingState label="Loading investor dashboard…" />
        ) : null}

        {canReadDashboard && dashboardQuery.isError ? (
          <Card title="Dashboard unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                dashboardQuery.error,
                "We could not load the investor dashboard.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry investor dashboard"
              pending={dashboardQuery.isFetching}
              onPress={() => {
                void dashboardQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {dashboardQuery.data ? (
          <Card title="Snapshot" maxWidth={720}>
            <View style={{ gap: spacing.sm }}>
              <Text selectable style={{ color: colors.text }}>
                Investors: {dashboardQuery.data.totalInvestors}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Investments: {dashboardQuery.data.totalInvestments}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Est. investment: {dashboardQuery.data.totalEstInvestment}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Act. investment: {dashboardQuery.data.totalActInvestment}
              </Text>
            </View>
          </Card>
        ) : null}

        {canReadList && investorsQuery.isPending ? (
          <LoadingState label="Loading investors…" />
        ) : null}

        {canReadList && investorsQuery.isError ? (
          <Card title="Investors unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                investorsQuery.error,
                "We could not load investors.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry investors"
              pending={investorsQuery.isFetching}
              onPress={() => {
                void investorsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {investorsQuery.data ? (
          investorsQuery.data.data.length === 0 ? (
            <Card title="No investors">
              <Text selectable style={{ color: colors.textMuted }}>
                No investors are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Recent investors" style={{ gap: spacing.md }}>
              {investorsQuery.data.data.map((investor) => (
                <InvestorRow key={investor.id} investor={investor} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
