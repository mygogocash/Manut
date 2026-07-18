import {
  ApiError,
  listInvestors,
  investorsQueryKey,
  type Investor,
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

function canReadInvestors(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("investors:read") ||
    hasPermission("investors:read-all") ||
    hasPermission("investors:create") ||
    hasPermission("investors:update") ||
    hasPermission("investors:delete")
  );
}

function InvestorRow({ investor }: { investor: Investor }) {
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
        {investor.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {investor.type} · {investor.status}
        {investor.location ? ` · ${investor.location}` : ""}
        {investor.region ? ` · ${investor.region}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {investor.contactName ?? "No contact"} ·{" "}
        {investor.adder ? investor.adder.name : "Unassigned"} ·{" "}
        {investor.investmentCount} investment
        {investor.investmentCount === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

export function InvestorsScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadInvestors(hasPermission);

  const investorsQuery = useQuery({
    queryKey: investorsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listInvestors(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Investors" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view investors.
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
            Investors
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only investor list. Pipeline board, amounts, and contact
            secrets remain later.
          </Text>
        </View>

        {investorsQuery.isPending ? (
          <LoadingState label="Loading investors…" />
        ) : null}

        {investorsQuery.isError ? (
          <Card title="Investors unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                investorsQuery.error,
                "We could not load investors.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry investors"
              pending={investorsQuery.isFetching}
              onPress={() => {
                void investorsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {investorsQuery.data ? (
          investorsQuery.data.data.length === 0 ? (
            <Card title="No investors">
              <Text selectable style={{ color: colors.textMuted }}>
                No investors are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Investors" style={{ gap: spacing.md }}>
              {investorsQuery.data.data.map((investor) => (
                <InvestorRow key={investor.id} investor={investor} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
