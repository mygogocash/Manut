import {
  ApiError,
  esopEmployeeSummaryQueryKey,
  getEsopEmployeeSummary,
  type EsopGrantType,
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

import { esopGrantTypeLabel } from "@/features/hrms/esop-grant-type-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load this employee grant summary.";
}

export function GrantsDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ employeeId?: string }>();
  const employeeId =
    typeof params.employeeId === "string" ? params.employeeId : "";

  const summaryQuery = useQuery({
    queryKey: esopEmployeeSummaryQueryKey(employeeId),
    queryFn: ({ signal }) => getEsopEmployeeSummary(api, employeeId, signal),
    enabled: employeeId.length > 0,
  });

  if (!employeeId) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Grants" maxWidth={720}>
          <StatusMessage tone="error">Employee id is missing.</StatusMessage>
          <Button label="Back to HRMS" onPress={() => router.push("/hrms")} />
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
          label="Back to HRMS"
          accessibilityLabel="Back to HRMS"
          onPress={() => router.push("/hrms")}
        />

        {summaryQuery.isPending ? (
          <LoadingState label="Loading grants…" />
        ) : null}

        {summaryQuery.isError ? (
          <Card title="Grants unavailable">
            <StatusMessage tone="error">
              {errorMessage(summaryQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry employee grants"
              pending={summaryQuery.isFetching}
              onPress={() => {
                void summaryQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {summaryQuery.data === null ? (
          <Card title="Employee not found">
            <Text selectable style={{ color: colors.textMuted }}>
              No grant summary is available for this employee.
            </Text>
          </Card>
        ) : null}

        {summaryQuery.data ? (
          <>
            <Card
              title={summaryQuery.data.employee.name}
              description={
                summaryQuery.data.employee.department ?? "No department"
              }
            >
              <View style={{ gap: spacing.xs }}>
                <Text selectable style={{ color: colors.textMuted }}>
                  Total {summaryQuery.data.kpis.grandTotal} · Vesting{" "}
                  {summaryQuery.data.kpis.vesting} · Vested{" "}
                  {summaryQuery.data.kpis.vested} · Vested to date{" "}
                  {summaryQuery.data.kpis.vestedToDate}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  Import, currency amounts, and pool edits remain later.
                </Text>
              </View>
            </Card>

            {summaryQuery.data.instruments.length === 0 ? (
              <Card title="No instruments">
                <Text selectable style={{ color: colors.textMuted }}>
                  This employee has no active grants.
                </Text>
              </Card>
            ) : (
              <View
                accessibilityLabel="Employee grant instruments"
                style={{ gap: spacing.md }}
              >
                {summaryQuery.data.instruments.map((instrument) => (
                  <Card
                    key={instrument.id}
                    title={esopGrantTypeLabel(
                      instrument.grantType as EsopGrantType,
                    )}
                    description={instrument.status}
                  >
                    <Text selectable style={{ color: colors.textMuted }}>
                      Granted {instrument.grantDate} · {instrument.shares}{" "}
                      shares · vested {instrument.vestedToDate}
                      {instrument.scheduled ? " · scheduled" : ""}
                    </Text>
                  </Card>
                ))}
              </View>
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
