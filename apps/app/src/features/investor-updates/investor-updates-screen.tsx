import {
  ApiError,
  listInvestorUpdates,
  investorUpdatesQueryKey,
  type InvestorUpdate,
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
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadInvestorUpdates(
  hasPermission: (code: string) => boolean,
): boolean {
  return (
    hasPermission("investor-updates:read") ||
    hasPermission("investor-updates:create") ||
    hasPermission("investor-updates:send")
  );
}

function InvestorUpdateRow({ update }: { update: InvestorUpdate }) {
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
        {update.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {update.period} · {update.status}
      </Text>
      {update.sender ? (
        <Text selectable style={{ color: colors.textMuted }}>
          Sent by {update.sender.name}
        </Text>
      ) : null}
    </View>
  );
}

export function InvestorUpdatesScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadInvestorUpdates(hasPermission);

  const updatesQuery = useQuery({
    queryKey: investorUpdatesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listInvestorUpdates(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Investor updates" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view investor updates.
          </StatusMessage>
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
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Investor updates
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only update list. Compose, send, and body view remain later.
          </Text>
        </View>

        {updatesQuery.isPending ? (
          <LoadingState label="Loading investor updates…" />
        ) : null}

        {updatesQuery.isError ? (
          <Card title="Investor updates unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                updatesQuery.error,
                "We could not load investor updates.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry investor updates"
              pending={updatesQuery.isFetching}
              onPress={() => {
                void updatesQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {updatesQuery.data ? (
          updatesQuery.data.data.length === 0 ? (
            <Card title="No investor updates">
              <Text selectable style={{ color: colors.textMuted }}>
                No investor updates are available yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Investor updates"
              style={{ gap: spacing.md }}
            >
              {updatesQuery.data.data.map((update) => (
                <InvestorUpdateRow key={update.id} update={update} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
