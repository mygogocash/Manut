import {
  ApiError,
  listPayrollRuns,
  payrollRunsQueryKey,
  type PayrollRun,
  type PayrollRunStatus,
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
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { payrollStatusLabel } from "@/features/payroll/payroll-status-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadPayroll(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("payroll:read") ||
    hasPermission("payroll:create") ||
    hasPermission("payroll:approve") ||
    hasPermission("payroll:hr-admin")
  );
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PayrollRunRow({ run }: { run: PayrollRun }) {
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
        {run.period} · {payrollStatusLabel(run.status)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {run.entity.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Net {formatMoney(run.totalNet)} · Tax {formatMoney(run.totalTax)} · Gross{" "}
        {formatMoney(run.totalGross)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Runner {run.runner.name}
        {run.approver ? ` · Approver ${run.approver.name}` : ""}
      </Text>
    </View>
  );
}

const STATUS_FILTERS: Array<{ label: string; value?: PayrollRunStatus }> = [
  { label: "All" },
  { label: "Draft", value: "draft" },
  { label: "Approved", value: "approved" },
  { label: "Paid", value: "paid" },
];

export function PayrollScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadPayroll(hasPermission);
  const canViewApprovalChain =
    hasPermission("payroll:hr-admin") || hasPermission("payroll:approve");
  const [statusFilter, setStatusFilter] = useState<
    PayrollRunStatus | undefined
  >(undefined);

  const runsQuery = useQuery({
    queryKey: payrollRunsQueryKey({
      page: 1,
      limit: 20,
      status: statusFilter,
    }),
    queryFn: ({ signal }) =>
      listPayrollRuns(
        api,
        { page: 1, limit: 20, status: statusFilter },
        signal,
      ),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Payroll" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view payroll runs.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Card title="Payroll" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Read-only payroll runs for periods you can access. Create, approve,
          imports, and payslip downloads stay on the web until a later slice.
        </Text>
        {canViewApprovalChain ? (
          <Button
            label="Approval chain"
            pendingLabel="Opening…"
            accessibilityLabel="Open payroll approval chain"
            onPress={() => {
              router.push("/payroll/approval");
            }}
          />
        ) : null}
      </Card>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        }}
      >
        {STATUS_FILTERS.map((filter) => {
          const selected = statusFilter === filter.value;
          return (
            <Pressable
              key={filter.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filter ${filter.label}`}
              onPress={() => setStatusFilter(filter.value)}
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

      {runsQuery.isPending ? (
        <LoadingState label="Loading payroll runs…" />
      ) : null}

      {runsQuery.isError ? (
        <Card title="Unable to load payroll" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(runsQuery.error, "We could not load payroll runs.")}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void runsQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {runsQuery.isSuccess && runsQuery.data.data.length === 0 ? (
        <Card title="No payroll runs" maxWidth={720}>
          <StatusMessage tone="info">
            No payroll runs match this filter.
          </StatusMessage>
        </Card>
      ) : null}

      {runsQuery.isSuccess
        ? runsQuery.data.data.map((run) => (
            <PayrollRunRow key={run.id} run={run} />
          ))
        : null}
    </ScrollView>
  );
}
