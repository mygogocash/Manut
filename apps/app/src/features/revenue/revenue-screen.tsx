import {
  ApiError,
  getRevenueDashboard,
  revenueDashboardQueryKey,
  type RevenuePeriod,
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
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadRevenue(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("revenue:read");
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatGrowth(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

const PERIOD_FILTERS: Array<{ label: string; value: RevenuePeriod }> = [
  { label: "3 months", value: "3m" },
  { label: "6 months", value: "6m" },
  { label: "12 months", value: "12m" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

function KpiRow({ label, value }: { label: string; value: string }) {
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
      <Text selectable style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {value}
      </Text>
    </View>
  );
}

export function RevenueScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadRevenue(hasPermission);
  const [period, setPeriod] = useState<RevenuePeriod>("12m");

  const dashboardQuery = useQuery({
    queryKey: revenueDashboardQueryKey({ period }),
    queryFn: ({ signal }) => getRevenueDashboard(api, { period }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Revenue" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view revenue analytics.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  const data = dashboardQuery.data;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Card title="Revenue" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Read-only revenue KPIs for the selected period. Charts, investments
          detail, and invoice status breakdowns stay on the web until a later
          slice.
        </Text>
      </Card>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        }}
      >
        {PERIOD_FILTERS.map((filter) => {
          const selected = period === filter.value;
          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Period ${filter.label}`}
              onPress={() => setPeriod(filter.value)}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: spacing.lg,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.borderStrong,
                borderRadius: radii.control,
                backgroundColor: pressed
                  ? colors.canvas
                  : selected
                    ? colors.surfaceRaised
                    : colors.canvas,
              })}
            >
              <Text
                style={{
                  color: selected ? colors.text : colors.textMuted,
                  fontWeight: selected ? "600" : "400",
                }}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {dashboardQuery.isPending ? (
        <LoadingState label="Loading revenue…" />
      ) : null}

      {dashboardQuery.isError ? (
        <Card title="Unable to load revenue" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(dashboardQuery.error, "We could not load revenue.")}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void dashboardQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {data ? (
        <View style={{ gap: spacing.md }}>
          <KpiRow
            label="Total investments"
            value={`${formatMoney(data.totalInvestments)} · ${data.investorCount} investors`}
          />
          <KpiRow
            label="Total invoiced"
            value={`${formatMoney(data.totalInvoiced)} · ${data.invoiceCount} invoices`}
          />
          <KpiRow
            label="Total expenses"
            value={formatMoney(data.totalExpenses)}
          />
          <KpiRow
            label="Pipeline value"
            value={formatMoney(data.pipelineValue)}
          />
          <KpiRow
            label="Latest monthly growth"
            value={formatGrowth(data.latestGrowth)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
