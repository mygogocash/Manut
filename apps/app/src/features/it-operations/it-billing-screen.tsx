import {
  ApiError,
  itBillingSubscriptionsQueryKey,
  listItSubscriptions,
  type ItSubscription,
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

function canReadBilling(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("it:billing:view") || hasPermission("it:billing:manage")
  );
}

function SubscriptionRow({ subscription }: { subscription: ItSubscription }) {
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
        {subscription.productName} · {subscription.vendorName}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {subscription.monthlySpend} {subscription.currency}/mo ·{" "}
        {subscription.status}
        {subscription.renewalDate
          ? ` · Renews ${subscription.renewalDate.slice(0, 10)}`
          : ""}
      </Text>
    </View>
  );
}

export function ItBillingScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadBilling(hasPermission);

  const subscriptionsQuery = useQuery({
    queryKey: itBillingSubscriptionsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listItSubscriptions(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="IT Billing" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view IT billing.
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
        <Card title="IT Billing" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only subscription list. Vendor CRUD, renewals, and alerts
              remain deferred.
            </Text>
            {subscriptionsQuery.isLoading ? (
              <LoadingState label="Loading subscriptions…" />
            ) : null}
            {subscriptionsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    subscriptionsQuery.error,
                    "Unable to load subscriptions.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void subscriptionsQuery.refetch()}
                />
              </View>
            ) : null}
            {subscriptionsQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No subscriptions found.</StatusMessage>
            ) : null}
            {subscriptionsQuery.data?.data.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
              />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
