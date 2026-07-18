import {
  ApiError,
  cashAdvanceApproverTypeLabel,
  CASH_ADVANCE_APPROVAL_STEPS_QUERY_KEY,
  listCashAdvanceApprovalSteps,
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
    : "We could not load the cash-advance approval chain.";
}

export function CashAdvanceApprovalScreen() {
  const api = useApiClient();
  const stepsQuery = useQuery({
    queryKey: CASH_ADVANCE_APPROVAL_STEPS_QUERY_KEY,
    queryFn: ({ signal }) => listCashAdvanceApprovalSteps(api, signal),
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
            Cash-advance approval chain
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only view of cash-advance approval steps. Reorder, edit,
            approve actions, and disbursement remain later.
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
              accessibilityLabel="Retry cash-advance approval steps"
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
                No cash-advance approval steps are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Cash-advance approval steps"
              style={{ gap: spacing.md }}
            >
              {stepsQuery.data.map((step) => (
                <Card
                  key={step.id}
                  title={`${step.order}. ${step.name}`}
                  description={cashAdvanceApproverTypeLabel(step.approverType)}
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {step.isActive ? "Active" : "Inactive"}
                      {step.approverUser
                        ? ` · ${step.approverUser.name}`
                        : ""}
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
