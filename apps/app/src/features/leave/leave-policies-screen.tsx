import {
  ApiError,
  leaveCategoryLabel,
  leavePoliciesQueryKey,
  listLeavePolicies,
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
    : "We could not load leave policies.";
}

export function LeavePoliciesScreen() {
  const api = useApiClient();
  const policiesQuery = useQuery({
    queryKey: leavePoliciesQueryKey(),
    queryFn: ({ signal }) => listLeavePolicies(api, signal),
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
            Leave policies
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only catalog of leave types. Create, edit, import, and
            per-policy approvers remain on admin tools for now.
          </Text>
        </View>

        {policiesQuery.isPending ? (
          <LoadingState label="Loading leave policies…" />
        ) : null}

        {policiesQuery.isError ? (
          <Card title="Policies unavailable">
            <StatusMessage tone="error">
              {errorMessage(policiesQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry leave policies"
              pending={policiesQuery.isFetching}
              onPress={() => {
                void policiesQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {policiesQuery.data ? (
          policiesQuery.data.length === 0 ? (
            <Card title="No leave policies">
              <Text selectable style={{ color: colors.textMuted }}>
                No leave types are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Leave policies"
              style={{ gap: spacing.md }}
            >
              {policiesQuery.data.map((policy) => (
                <Card
                  key={policy.id}
                  title={policy.name}
                  description={`${policy.code} · ${leaveCategoryLabel(policy.category)}`}
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {policy.daysPerYear} days/year
                      {policy.isPaid ? " · Paid" : " · Unpaid"}
                      {policy.requiresApproval
                        ? " · Requires approval"
                        : " · Auto-approve"}
                      {policy.isActive ? "" : " · Inactive"}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {policy.entity?.name ?? "Global"}
                    </Text>
                    {policy.description ? (
                      <Text selectable style={{ color: colors.textMuted }}>
                        {policy.description}
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
