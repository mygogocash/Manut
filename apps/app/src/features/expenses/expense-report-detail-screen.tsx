import {
  ApiError,
  expenseReportDetailQueryKey,
  getExpenseReport,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { expenseStatusLabel } from "@/features/expenses/expense-status-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load this expense report.";
}

function formatTotal(
  totalAmount: number,
  totalCurrency: string,
  converted: boolean,
): string {
  if (!converted) return "— (rate missing)";
  return `${totalAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${totalCurrency}`;
}

export function ExpenseReportDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ reportId?: string }>();
  const reportId =
    typeof params.reportId === "string" ? params.reportId : "";

  const detailQuery = useQuery({
    queryKey: expenseReportDetailQueryKey(reportId),
    queryFn: ({ signal }) => getExpenseReport(api, reportId, signal),
    enabled: reportId.length > 0,
  });

  if (!reportId) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Expense report" maxWidth={720}>
          <StatusMessage tone="error">Report id is missing.</StatusMessage>
          <Button
            label="Back to expenses"
            onPress={() => router.push("/expenses")}
          />
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
        <Button
          label="Back to expenses"
          accessibilityLabel="Back to expenses"
          onPress={() => router.push("/expenses")}
        />

        {detailQuery.isPending ? (
          <LoadingState label="Loading expense report…" />
        ) : null}

        {detailQuery.isError ? (
          <Card title="Expense report unavailable">
            <StatusMessage tone="error">
              {errorMessage(detailQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry expense report"
              pending={detailQuery.isFetching}
              onPress={() => {
                void detailQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {detailQuery.data ? (
          <Card
            title={detailQuery.data.title}
            description={`${expenseStatusLabel(detailQuery.data.status)} · ${detailQuery.data.period}`}
          >
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={{ color: colors.textMuted }}>
                {detailQuery.data.employee.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Entity {detailQuery.data.entity.name} ·{" "}
                {detailQuery.data.category.replaceAll("_", " ")}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Total{" "}
                {formatTotal(
                  detailQuery.data.totalAmount,
                  detailQuery.data.totalCurrency,
                  detailQuery.data.converted,
                )}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {detailQuery.data.lineCount} line
                {detailQuery.data.lineCount === 1 ? "" : "s"}
              </Text>
              {detailQuery.data.rejectReason ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  Rejected: {detailQuery.data.rejectReason}
                </Text>
              ) : null}
              <Text selectable style={{ color: colors.textMuted }}>
                Line items, receipts, and approve actions remain later.
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
