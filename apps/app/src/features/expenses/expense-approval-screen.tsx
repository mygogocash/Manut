import {
  ApiError,
  expenseApproverTypeLabel,
  EXPENSE_APPROVAL_STEPS_QUERY_KEY,
  listExpenseApprovalSteps,
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
    : "We could not load the expense approval chain.";
}

export function ExpenseApprovalScreen() {
  const api = useApiClient();
  const stepsQuery = useQuery({
    queryKey: EXPENSE_APPROVAL_STEPS_QUERY_KEY,
    queryFn: ({ signal }) => listExpenseApprovalSteps(api, signal),
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
            Expense approval chain
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only view of org-wide expense approval steps. Reorder, edit,
            and notification recipients remain later.
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
              accessibilityLabel="Retry expense approval steps"
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
                No expense approval steps are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Expense approval steps"
              style={{ gap: spacing.md }}
            >
              {stepsQuery.data.map((step) => (
                <Card
                  key={step.id}
                  title={`${step.order}. ${step.name}`}
                  description={expenseApproverTypeLabel(step.approverType)}
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
