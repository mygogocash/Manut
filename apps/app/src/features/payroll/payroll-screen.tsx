import {
  ApiError,
  approvePayrollRun,
  listMyPayslips,
  listPayrollRuns,
  MY_PAYSLIPS_QUERY_KEY,
  PAYROLL_RUNS_QUERY_ROOT,
  payrollRunsQueryKey,
  type MyPayslip,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function PayrollRunRow({
  run,
  canApprove,
  approving,
  approveDisabled,
  onApprove,
}: {
  run: PayrollRun;
  canApprove: boolean;
  approving: boolean;
  approveDisabled: boolean;
  onApprove: () => void;
}) {
  const showApprove = canApprove && run.status === "draft";

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
      {showApprove ? (
        <Button
          label="Approve run"
          pendingLabel="Approving…"
          accessibilityLabel={`Approve payroll run ${run.period}`}
          pending={approving}
          disabled={approveDisabled}
          onPress={onApprove}
        />
      ) : null}
    </View>
  );
}

function MyPayslipRow({ slip }: { slip: MyPayslip }) {
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
        {slip.payrollRun.period} ·{" "}
        {payrollStatusLabel(slip.payrollRun.status)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {slip.payrollRun.entity.name} · {slip.currency}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Net {formatMoney(slip.netPay)} · Gross {formatMoney(slip.grossPay)} ·
        Base {formatMoney(slip.baseSalary)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {slip.hasDocument
          ? "Document on file (download deferred)"
          : "No document attached"}
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
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = canReadPayroll(hasPermission);
  const canApprove = hasPermission("payroll:approve");
  const canViewApprovalChain =
    hasPermission("payroll:hr-admin") || hasPermission("payroll:approve");
  const [statusFilter, setStatusFilter] = useState<
    PayrollRunStatus | undefined
  >(undefined);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const myPayslipsQuery = useQuery({
    queryKey: MY_PAYSLIPS_QUERY_KEY,
    queryFn: ({ signal }) => listMyPayslips(api, signal),
    enabled: allowed,
  });

  const approveMutation = useMutation({
    mutationFn: (runId: string) => approvePayrollRun(api, runId),
    onSuccess: () => {
      setActionMessage("Payroll run approved.");
      void queryClient.invalidateQueries({
        queryKey: PAYROLL_RUNS_QUERY_ROOT,
      });
      void queryClient.invalidateQueries({
        queryKey: MY_PAYSLIPS_QUERY_KEY,
      });
    },
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
          Payroll runs you can access plus your own payslip list. Draft runs
          can be approved when you have payroll:approve. Create, imports, and
          payslip downloads stay deferred.
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
        {actionMessage ? (
          <StatusMessage tone="success">{actionMessage}</StatusMessage>
        ) : null}
        {approveMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              approveMutation.error,
              "The payroll run could not be approved.",
            )}
          </StatusMessage>
        ) : null}
      </Card>

      <Card title="My payslips" maxWidth={720}>
        {myPayslipsQuery.isPending ? (
          <LoadingState label="Loading my payslips…" />
        ) : null}
        {myPayslipsQuery.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              myPayslipsQuery.error,
              "We could not load your payslips.",
            )}
          </StatusMessage>
        ) : null}
        {myPayslipsQuery.isSuccess &&
        myPayslipsQuery.data.data.length === 0 ? (
          <StatusMessage tone="info">
            No payslips are assigned to you yet.
          </StatusMessage>
        ) : null}
      </Card>

      {myPayslipsQuery.isSuccess
        ? myPayslipsQuery.data.data.map((slip) => (
            <MyPayslipRow key={slip.id} slip={slip} />
          ))
        : null}

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
            <PayrollRunRow
              key={run.id}
              run={run}
              canApprove={canApprove}
              approving={
                approveMutation.isPending &&
                approveMutation.variables === run.id
              }
              approveDisabled={approveMutation.isPending}
              onApprove={() => {
                setActionMessage(null);
                approveMutation.reset();
                approveMutation.mutate(run.id);
              }}
            />
          ))
        : null}
    </ScrollView>
  );
}
