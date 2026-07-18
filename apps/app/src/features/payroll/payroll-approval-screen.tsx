import {
  ApiError,
  listPayrollApprovalSteps,
  PAYROLL_APPROVAL_STEPS_QUERY_KEY,
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
import { ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load the payroll approval chain.";
}

export function PayrollApprovalScreen() {
  const api = useApiClient();
  const stepsQuery = useQuery({
    queryKey: PAYROLL_APPROVAL_STEPS_QUERY_KEY,
    queryFn: ({ signal }) => listPayrollApprovalSteps(api, signal),
  });

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
            Payroll approval chain
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only view of payroll run approval steps. Create, edit, and
            reorder remain later.
          </Text>
        </View>

        {stepsQuery.isPending ? (
          <LoadingState label="Loading approval steps…" />
        ) : null}

        {stepsQuery.isError ? (
          <Card title="Approval chain unavailable">
            <StatusMessage tone="error">
              {errorMessage(stepsQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry payroll approval steps"
              pending={stepsQuery.isFetching}
              onPress={() => {
                void stepsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {stepsQuery.data ? (
          stepsQuery.data.length === 0 ? (
            <Card title="No approval steps">
              <Text selectable style={{ color: colors.textMuted }}>
                No payroll approval steps are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Payroll approval steps"
              style={{ gap: spacing.md }}
            >
              {stepsQuery.data.map((step) => (
                <Card
                  key={step.id}
                  title={`${step.order}. ${step.name}`}
                  description={
                    step.approverUser
                      ? step.approverUser.name
                      : "Assigned approver"
                  }
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {step.isActive ? "Active" : "Inactive"}
                    </Text>
                    {step.description ? (
                      <Text selectable style={{ color: colors.textMuted }}>
                        {step.description}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
