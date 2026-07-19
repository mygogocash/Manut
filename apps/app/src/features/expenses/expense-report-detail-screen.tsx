import {
  ApiError,
  expenseReportDetailQueryKey,
  getExpenseLineReceiptUrl,
  getExpenseReport,
  type ExpenseLine,
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
import { useCallback, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";

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

function formatLineAmount(amount: string, currency: string): string {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return `${amount} ${currency}`;
  return `${parsed.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function ExpenseLineRow({
  line,
  reportId,
  onOpenReceipt,
  openingReceiptId,
}: {
  line: ExpenseLine;
  reportId: string;
  onOpenReceipt: (reportId: string, line: ExpenseLine) => Promise<void>;
  openingReceiptId: string | null;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={{ color: colors.text }}>
        {line.description}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {formatLineAmount(line.amount, line.currency)} · {line.date}
      </Text>
      {line.hasReceipt ? (
        <Button
          label="View receipt"
          pendingLabel="Opening…"
          accessibilityLabel={`View receipt for ${line.description}`}
          pending={openingReceiptId === line.id}
          onPress={() => {
            void onOpenReceipt(reportId, line);
          }}
        />
      ) : null}
    </View>
  );
}

export function ExpenseReportDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ reportId?: string }>();
  const reportId =
    typeof params.reportId === "string" ? params.reportId : "";
  const [openingReceiptId, setOpeningReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: expenseReportDetailQueryKey(reportId),
    queryFn: ({ signal }) => getExpenseReport(api, reportId, signal),
    enabled: reportId.length > 0,
  });

  const openReceipt = useCallback(
    async (activeReportId: string, line: ExpenseLine) => {
      setReceiptError(null);
      setOpeningReceiptId(line.id);
      try {
        const { url } = await getExpenseLineReceiptUrl(
          api,
          activeReportId,
          line.id,
        );
        await Linking.openURL(url);
      } catch (error) {
        setReceiptError(
          error instanceof ApiError
            ? error.message
            : "We could not open this receipt.",
        );
      } finally {
        setOpeningReceiptId(null);
      }
    },
    [api],
  );

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
            <View style={{ gap: spacing.md }}>
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
              </View>

              {detailQuery.data.lines.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  <Text selectable style={{ color: colors.text }}>
                    Line items
                  </Text>
                  {detailQuery.data.lines.map((line) => (
                    <ExpenseLineRow
                      key={line.id}
                      line={line}
                      reportId={reportId}
                      onOpenReceipt={openReceipt}
                      openingReceiptId={openingReceiptId}
                    />
                  ))}
                </View>
              ) : null}

              {receiptError ? (
                <StatusMessage tone="error">{receiptError}</StatusMessage>
              ) : null}
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
