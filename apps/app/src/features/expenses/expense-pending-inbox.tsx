import {
  ApiError,
  approveExpenseReport,
  canActOnExpenseReport,
  EXPENSE_REPORTS_QUERY_ROOT,
  expenseReportsQueryKey,
  listExpenseReports,
  rejectExpenseReport,
  rejectExpenseReportInputSchema,
  type ExpenseReport,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
  TextField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatTotal(report: ExpenseReport): string {
  if (!report.converted) return "— (rate missing)";
  return `${report.totalAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${report.totalCurrency}`;
}

export function ExpensePendingInbox() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectValidation, setRejectValidation] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const inboxQuery = useQuery({
    queryKey: expenseReportsQueryKey({
      pendingForMe: true,
      page: 1,
      limit: 20,
    }),
    queryFn: ({ signal }) =>
      listExpenseReports(
        api,
        { pendingForMe: true, page: 1, limit: 20 },
        signal,
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (reportId: string) => approveExpenseReport(api, reportId),
    onSuccess: () => {
      setActionMessage("Expense report approved.");
      setRejectingId(null);
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_REPORTS_QUERY_ROOT,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      reportId,
      reason,
    }: {
      reportId: string;
      reason: string;
    }) => rejectExpenseReport(api, reportId, { reason }),
    onSuccess: () => {
      setActionMessage("Expense report rejected.");
      setRejectingId(null);
      setRejectReason("");
      setRejectValidation(null);
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_REPORTS_QUERY_ROOT,
      });
    },
  });

  const reports = inboxQuery.data?.data ?? [];

  function submitReject(reportId: string) {
    const parsed = rejectExpenseReportInputSchema.safeParse({
      reason: rejectReason,
    });
    if (!parsed.success) {
      setRejectValidation(
        parsed.error.issues[0]?.message ?? "Reason is required",
      );
      return;
    }
    setRejectValidation(null);
    rejectMutation.mutate({ reportId, reason: parsed.data.reason });
  }

  return (
    <Card
      title="Pending approvals"
      description="Submitted expense reports waiting for your approval."
      maxWidth={1080}
    >
      {actionMessage ? (
        <StatusMessage tone="success">{actionMessage}</StatusMessage>
      ) : null}

      {approveMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            approveMutation.error,
            "The expense report could not be approved.",
          )}
        </StatusMessage>
      ) : null}

      {rejectMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            rejectMutation.error,
            "The expense report could not be rejected.",
          )}
        </StatusMessage>
      ) : null}

      {inboxQuery.isPending ? (
        <LoadingState label="Loading pending approvals…" />
      ) : null}

      {inboxQuery.isError ? (
        <View style={{ gap: spacing.md }}>
          <StatusMessage tone="error">
            {errorMessage(
              inboxQuery.error,
              "We could not load pending expense approvals.",
            )}
          </StatusMessage>
          <Button
            label="Retry approvals"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry expense approvals"
            pending={inboxQuery.isFetching}
            onPress={() => {
              void inboxQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {inboxQuery.data ? (
        reports.length === 0 ? (
          <Text selectable style={{ color: colors.textMuted }}>
            No submitted expense reports need your approval.
          </Text>
        ) : (
          <View
            accessibilityLabel="Pending expense approvals"
            style={{ gap: spacing.lg }}
          >
            {reports.map((report) => {
              const actionable = canActOnExpenseReport(report.status);
              const isRejecting = rejectingId === report.id;
              return (
                <View key={report.id} style={{ gap: spacing.sm }}>
                  <Text
                    selectable
                    style={{ fontWeight: "600", color: colors.text }}
                  >
                    {report.employee.name} · {report.title}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted }}>
                    {report.period} · {formatTotal(report)} ·{" "}
                    {report.entity.name}
                  </Text>
                  {actionable && !isRejecting ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: spacing.sm,
                      }}
                    >
                      <Button
                        label="Approve"
                        pendingLabel="Approving…"
                        accessibilityLabel={`Approve expense for ${report.employee.name}`}
                        pending={
                          approveMutation.isPending &&
                          approveMutation.variables === report.id
                        }
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                        onPress={() => {
                          setActionMessage(null);
                          rejectMutation.reset();
                          approveMutation.mutate(report.id);
                        }}
                      />
                      <Button
                        label="Reject"
                        pendingLabel="Opening…"
                        accessibilityLabel={`Reject expense for ${report.employee.name}`}
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                        onPress={() => {
                          setActionMessage(null);
                          approveMutation.reset();
                          setRejectReason("");
                          setRejectValidation(null);
                          setRejectingId(report.id);
                        }}
                      />
                    </View>
                  ) : null}
                  {isRejecting ? (
                    <View style={{ gap: spacing.sm }}>
                      <TextField
                        label="Rejection reason"
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        accessibilityLabel="Expense rejection reason"
                      />
                      {rejectValidation ? (
                        <StatusMessage tone="error">
                          {rejectValidation}
                        </StatusMessage>
                      ) : null}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: spacing.sm,
                        }}
                      >
                        <Button
                          label="Confirm reject"
                          pendingLabel="Rejecting…"
                          accessibilityLabel={`Confirm reject expense for ${report.employee.name}`}
                          pending={
                            rejectMutation.isPending &&
                            rejectMutation.variables?.reportId === report.id
                          }
                          onPress={() => submitReject(report.id)}
                        />
                        <Button
                          label="Cancel"
                          pendingLabel="Closing…"
                          accessibilityLabel="Cancel expense rejection"
                          disabled={rejectMutation.isPending}
                          onPress={() => {
                            setRejectingId(null);
                            setRejectReason("");
                            setRejectValidation(null);
                          }}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )
      ) : null}
    </Card>
  );
}
