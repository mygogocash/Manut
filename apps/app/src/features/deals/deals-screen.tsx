import {
  ApiError,
  dealsQueryKey,
  listDeals,
  type Deal,
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

function canReadDeals(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("deals:read");
}

function DealRow({ deal }: { deal: Deal }) {
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
        {deal.company}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {deal.stage} · {deal.value}
        {deal.contact ? ` · ${deal.contact}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {deal.owner.name}
        {deal.country ? ` · ${deal.country}` : ""}
      </Text>
    </View>
  );
}

export function DealsScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadDeals(hasPermission);

  const dealsQuery = useQuery({
    queryKey: dealsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listDeals(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Deals" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view deals.
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
            Deals
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only deals list. Pipeline summary, notes, and writes remain
            later.
          </Text>
        </View>

        {dealsQuery.isPending ? <LoadingState label="Loading deals…" /> : null}

        {dealsQuery.isError ? (
          <Card title="Deals unavailable">
            <StatusMessage tone="error">
              {errorMessage(dealsQuery.error, "We could not load deals.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry deals"
              pending={dealsQuery.isFetching}
              onPress={() => {
                void dealsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {dealsQuery.data ? (
          dealsQuery.data.data.length === 0 ? (
            <Card title="No deals">
              <Text selectable style={{ color: colors.textMuted }}>
                No deals are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Deals" style={{ gap: spacing.md }}>
              {dealsQuery.data.data.map((deal) => (
                <DealRow key={deal.id} deal={deal} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
