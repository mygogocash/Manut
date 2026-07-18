import {
  ApiError,
  listTravelApprovalSteps,
  TRAVEL_APPROVAL_STEPS_QUERY_KEY,
  travelApproverTypeLabel,
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
    : "We could not load the travel approval chain.";
}

export function TravelApprovalScreen() {
  const api = useApiClient();
  const stepsQuery = useQuery({
    queryKey: TRAVEL_APPROVAL_STEPS_QUERY_KEY,
    queryFn: ({ signal }) => listTravelApprovalSteps(api, signal),
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
            Travel approval chain
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only view of org-wide travel approval steps. Reorder, edit,
            amount bands, and travel-desk recipients remain later.
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
              accessibilityLabel="Retry travel approval steps"
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
                No travel approval steps are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Travel approval steps"
              style={{ gap: spacing.md }}
            >
              {stepsQuery.data.map((step) => (
                <Card
                  key={step.id}
                  title={`${step.order}. ${step.name}`}
                  description={travelApproverTypeLabel(step.approverType)}
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
